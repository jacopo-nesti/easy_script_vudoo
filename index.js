import { token, inventoryId, testMode, dryRun } from './src/config.js';
import { log } from './src/logger.js';
import { getBaseInventory, getBasePriceGroup, getBaseWarehouse, productExistsInBase, sendProductToBase } from './src/baseApi.js';
import { getProducts, normalizeProduct } from './src/products.js';
import { getManufacturerMap, assignManufacturer } from './src/manufacturers.js';

async function main() {
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
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let simulated = 0;
  let selectedCount = 0;
  let errors = 0;
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

    // RECUPERO PRODUTTORI DA BASE.COM
    stage = 'recupero produttori';
    const mfgMap = await getManufacturerMap();

    stage = 'lettura real_products.json';
    log('File sorgente: real_products.json');
    log('[DEBUG] Lettura real_products.json');
    const products = await getProducts();
    read = products.length;
    log(`[DEBUG] Prodotti trovati nel JSON: ${read}`);
    const selected = testMode === 'true' ? products.slice(0, 1) : products;
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

    for (const sourceProduct of selected) {
      processed++;
      log(`\nImportazione ${sourceProduct?.id ?? '(SKU assente)'}...`);
      try {
        const product = normalizeProduct(sourceProduct);

        // ABBINAMENTO MANUFACTURER_ID TRAMITE IL NOME DEL BRAND
        assignManufacturer(product, mfgMap);

        log(`[DEBUG] Normalizzazione completata\nProdotto normalizzato:\n${JSON.stringify(product, null, 2)}`);
        log(`SKU: ${product.sku ?? '(assente)'}\nNome: ${product.title ?? '(assente)'}\nEAN: ${product.ean ?? '(assente)'}\nPrezzo: ${product.price ?? '(assente)'}\nPeso: ${product.weight ?? '(assente)'}\nImmagine: ${product.image_link ?? '(assente)'}\nManufacturer ID: ${product.manufacturer_id ?? '(assente)'}`);

        if (await productExistsInBase(product.sku, config.inventory.inventory_id)) {
          skipped++;
          log(`SKIPPED - SKU ${product.sku} già presente nel catalogo`);
          continue;
        }

        const result = await sendProductToBase(product, config);
        if (!result) {
          simulated++;
          continue;
        }
        created++;
        log(`SUCCESS - product_id: ${result.product_id}`);
        if (result.warnings && Object.keys(result.warnings).length > 0) {
          log(`Avvisi Base.com: ${JSON.stringify(result.warnings)}`);
        }
      } catch (error) {
        errors++;
        errorSkus.push(sourceProduct?.id ?? 'sconosciuto');
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
    log(`\n=== RIEPILOGO FINALE ===`);
    log(`Prodotti letti: ${read}`);
    log(`Prodotti selezionati: ${selectedCount}`);
    log(`Prodotti processati: ${processed}`);
    log(``);
    log(`Creati: ${created}`);
    log(`Aggiornati: ${updated}`);
    log(`Già presenti: ${skipped}`);
    log(`Simulati: ${simulated}`);
    log(`Errori: ${errors}`);
    if (errorSkus.length > 0) {
      log(`SKU con errori: ${errorSkus.join(', ')}`);
    }
    if (errors > 0) process.exitCode = 1;
  }
}

main().catch(error => {
  log(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
