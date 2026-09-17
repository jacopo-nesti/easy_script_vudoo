import { getCategories, getOrCreateCategory } from './categories.js';
import { token, inventoryId, testMode, dryRun } from './src/config.js';
import { log } from './src/logger.js';
import { getBaseInventory, getBasePriceGroup, getBaseWarehouse, sendProductToBase, findProductInBase, getBaseProductDetails, updateProductInBase } from './src/baseApi.js';
import { getProducts, normalizeProduct, detectAndFilterDuplicates, buildBasePayload, hasProductChanged } from './src/products.js';
import { getManufacturerMap, ensureManufacturer } from './src/manufacturers.js';
import { getCategoryMap, ensureCategoryPath } from './src/categories.js';

async function main() {
  let ambiguous = 0;
  log('[DEBUG] Avvio script');
  log(`[DEBUG] BASE_INVENTORY_ID letto: ${inventoryId || '(non specificato)'}`);
  if (!token) throw new Error('BASE_API_TOKEN mancante nel file .env.');
  if (!['true', 'false'].includes(testMode) || !['true', 'false'].includes(dryRun)) {
    throw new Error('TEST_MODE e DRY_RUN devono essere true oppure false.');
  }
  log(`[DEBUG] TEST_MODE: ${testMode}\n[DEBUG] DRY_RUN: ${dryRun}`);
  const config = {};
  let read = 0;
  let processed = 0;
  let skipped = 0;
  let created = 0;
  let updated = 0;
  let simulated = 0;
  let imported = 0;
  let selectedCount = 0;
  let errors = 0;
  let feedDuplicates = 0;
  const errorSkus = [];
  let stage = 'getInventories';
  let warehouseStatus = 'non selezionato';

  try {
    config.inventory = await getBaseInventory();
    log(`[DEBUG] Inventory selezionato: ${config.inventory.name} (${config.inventory.inventory_id})`);
    
    stage = 'recupero gruppo prezzi';
    log('[DEBUG] Recupero gruppo prezzi');
    config.priceGroup = await getBasePriceGroup(config.inventory);
    log(`[DEBUG] Gruppo prezzi selezionato: ${config.priceGroup.name} (${config.priceGroup.price_group_id})`);

    stage = 'recupero produttori';
    const mfgMap = await getManufacturerMap();

    stage = 'lettura real_products.json';
    log('File sorgente: real_products.json');
    log('[DEBUG] Lettura real_products.json');
    const products = await getProducts();
    read = products.length;
    log(`[DEBUG] Prodotti trovati nel JSON: ${read}`);
    const candidates = testMode === 'true' ? products.slice(0, 1) : products;
    const { uniqueProducts: selected, duplicatesMap } = detectAndFilterDuplicates(candidates);
    for (const [sku, count] of duplicatesMap) {
      feedDuplicates += count - 1;
      log(`SKIPPED - SKU ${sku}: ${count - 1} duplicati equivalenti nel feed`);
    }
    selectedCount = selected.length;
    log(`Prodotti selezionati: ${selectedCount}`);
    if (testMode === 'true') {
      log(`TEST MODE\nProdotto selezionato: ${selected.length ? 'primo prodotto' : 'nessuno'}\nSKU: ${selected[0]?.id ?? '(assente)'}\nNome: ${selected[0]?.title ?? '(assente)'}`);
    }
    if (selected.some(product => product?.quantity != null)) {
      stage = 'recupero warehouse';
      log('[DEBUG] Recupero warehouse per le quantita');
      config.warehouse = await getBaseWarehouse(config.inventory);
      log(`[DEBUG] Warehouse selezionato: ${config.warehouse.name} (${config.warehouse.id})`);
    } else {
      warehouseStatus = 'non necessario';
    }
    stage = 'recupero categorie';
    const categoryMap = selected.some(product => product?.product_type)
      ? await getCategoryMap(config.inventory.inventory_id) : new Map();

    for (const sourceProduct of selected) {
      try {
        processed++;
        log(`\nImportazione ${sourceProduct?.id ?? '(SKU assente)'}...`);

        buildBasePayload(product, config);
        const existingProduct = await findProductInBase(product.sku, config.inventory.inventory_id);
        const existingDetails = existingProduct
          ? await getBaseProductDetails(config.inventory.inventory_id, existingProduct.product_id) : null;
        if (existingDetails && existingDetails.sku !== product.sku) throw new Error('SKU del dettaglio Base.com non corrispondente.');
        const categoryId = await ensureCategoryPath(product.product_type, config.inventory.inventory_id, categoryMap);
        const manufacturerId = await ensureManufacturer(product.brand, mfgMap);
        if (categoryId != null) product.category_id = categoryId;
        if (manufacturerId != null) product.manufacturer_id = manufacturerId;
        const pendingReferences = dryRun === 'true' &&
          ((product.product_type?.trim() && categoryId == null) || (product.brand?.trim() && manufacturerId == null));

        log(`[DEBUG] Normalizzazione completata\nProdotto normalizzato:\n${JSON.stringify(product, null, 2)}`);
        log(`SKU: ${product.sku ?? '(assente)'}\nNome: ${product.title ?? '(assente)'}\nEAN: ${product.ean ?? '(assente)'}\nPrezzo: ${product.price ?? '(assente)'}\nPeso: ${product.weight ?? '(assente)'}\nImmagine: ${product.image_link ?? '(assente)'}\nManufacturer ID: ${product.manufacturer_id ?? '(assente)'}`);
        
        if (existingProduct) {
          if (hasProductChanged(product, existingDetails, config)) {
            log(`Rilevate modifiche per SKU ${product.sku}. Procedo con l'aggiornamento...`);
            
            const result = await updateProductInBase(existingProduct.product_id, product, config, existingDetails);
            
            if (!result) {
              simulated++;
              continue;
            }
            updated++; // Incrementa il contatore degli aggiornati
            log(`SUCCESS (Aggiornato) - product_id: ${existingProduct.product_id}`);
            if (result.warnings && Object.keys(result.warnings).length) log(`Avvisi Base.com: ${JSON.stringify(result.warnings)}`);
          } else {
            if (pendingReferences) {
              simulated++;
              log('DRY_RUN: associazione categoria/produttore prevista; ID disponibili solo dopo la creazione reale.');
              continue;
            }
            skipped++;
            log(`SKIPPED - SKU ${product.sku} già presente e nessun dato modificato`);
          }
          continue; // Passa al prodotto successivo
        }
        
        // 4. Se il prodotto NON esiste, procedi alla creazione normale
        const result = await sendProductToBase(product, config);
        if (!result) {
          simulated++;
          continue;
        }
        created++;
        log(`SUCCESS (Creato) - product_id: ${result.product_id}`);

        if (result.warnings && Object.keys(result.warnings).length > 0) {
          log(`Avvisi Base.com: ${JSON.stringify(result.warnings)}`);
        }
      } catch (error) {
        errors++;
        errorSkus.push(sourceProduct?.id ?? '(SKU assente)');
        log(`ERROR: ${error.message}`);
      }
    }
  } catch (error) {
    errors++;
    log(`ERROR ${stage}: ${error.message}`);
  } finally {
    const { inventory, priceGroup, warehouse } = config;
    log(`\nInventory: ${inventory ? `${inventory.name} (${inventory.inventory_id})` : 'non selezionato'}`);
    log(`Gruppo prezzi: ${priceGroup ? `${priceGroup.name} (${priceGroup.price_group_id}, ${priceGroup.currency})` : 'non selezionato'}`);
    log(`Warehouse: ${warehouse ? `${warehouse.name} (${warehouse.id})` : warehouseStatus}`);
    log(`Prodotti letti: ${read}\nProdotti selezionati: ${selectedCount}\nProdotti processati: ${processed}\nCreati: ${created}\nAggiornati: ${updated}\nSaltati perché invariati: ${skipped}\nDuplicati nel feed saltati: ${feedDuplicates}\nSimulati: ${simulated}\nErrori: ${errors}`);
    if (errorSkus.length) log(`SKU con errori: ${errorSkus.join(', ')}`);
    if (errors > 0) process.exitCode = 1;
  }
  if (errors > 0) process.exitCode = 1;
}


main().catch(error => {
  log(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
