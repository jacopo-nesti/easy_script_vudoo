import { getCategories, getOrCreateCategory } from './categories.js';
import { token, inventoryId, testMode, dryRun } from './src/config.js';
import { log } from './src/logger.js';
import { checkSkuStatus, getBaseInventory, getBasePriceGroup, getBaseWarehouse, productExistsInBase, sendProductToBase } from './src/baseApi.js';
import { getProducts } from './src/products.js';
import { getManufacturerMap, assignManufacturer } from './src/manufacturers.js';

function parseFeedNumber(value, unit, fieldName) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') throw new Error(`Formato non valido per ${fieldName}`);
  let cleaned = value.replace(unit, '').trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) throw new Error(`Impossibile convertire '${value}' in numero per ${fieldName}`);
  return parsed;
}

function normalizeProduct(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Il prodotto deve essere un oggetto JSON.');
  }
  const normalized = { ...source };

  // Controllo campi obbligatori
  if (!source.id || typeof source.id !== 'string' || source.id.trim() === '') {
    throw new Error('Validazione fallita: SKU (id) mancante.');
  }
  if (!source.title || typeof source.title !== 'string' || source.title.trim() === '') {
    throw new Error('Validazione fallita: Titolo mancante.');
  }
  if (!source.price || typeof source.price !== 'string' || source.price.trim() === '') {
    throw new Error('Validazione fallita: Prezzo mancante.');
  }

  // Verifiche stringhe
  for (const field of ['id', 'ean', 'mpn', 'title', 'brand', 'condition', 'description',
    'image_link', 'link', 'product_type', 'availability', 'pickup_SLA']) {
    if (source[field] != null && typeof source[field] !== 'string') {
      throw new Error(`${field} deve essere una stringa.`);
    }
  }

  // Pulizia EAN
  if (source.ean != null) {
    normalized.ean = source.ean.replace(/\s+/g, '');
    if (normalized.ean !== '' && !/^\d{8,14}$/.test(normalized.ean)) {
      throw new Error(`Validazione fallita: EAN non valido (${source.ean}).`);
    }
  }

  // URL Immagine
  if (source.image_link != null) {
    if (!URL.canParse(source.image_link) || !['http:', 'https:'].includes(new URL(source.image_link).protocol)) {
      throw new Error(`Validazione fallita: URL immagine non valido (${source.image_link}).`);
    }
  }

  // Conversione SKU e Prezzi/Pesi
  normalized.sku = source.id.trim();
  for (const field of ['price', 'sale_price', 'weight', 'shipping_weight']) {
    if (source[field] == null) continue;
    const unit = field === 'price' || field === 'sale_price' ? 'EUR' : 'Kg';
    normalized[field] = parseFeedNumber(source[field], unit, field);
  }

  if (source.shipping != null) {
    if (typeof source.shipping !== 'object' || Array.isArray(source.shipping)) {
      throw new Error('shipping deve essere un oggetto.');
    }
    normalized.shipping = { ...source.shipping };
    if (source.shipping.price != null) {
      normalized.shipping.price = parseFeedNumber(source.shipping.price, 'EUR', 'shipping.price');
    }
  }

  return normalized;
}

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
  let imported = 0;
  let skipped = 0;
  let simulated = 0;
  let selectedCount = 0;
  let errors = 0;
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
    const existingCategories = await getCategories(config.inventory.inventory_id);

    for (const sourceProduct of selected) {
      try {
        processed++;
        log(`\nImportazione ${sourceProduct?.id ?? '(SKU assente)'}...`);

        // Normalizzazione del prodotto
        const product = normalizeProduct(sourceProduct);

        // Abbinamento produttore
        assignManufacturer(product, mfgMap);

        log(`[DEBUG] Normalizzazione completata\nProdotto normalizzato:\n${JSON.stringify(product, null, 2)}`);
        log(`SKU: ${product.sku ?? '(assente)'}\nNome: ${product.title ?? '(assente)'}\nEAN: ${product.ean ?? '(assente)'}\nPrezzo: ${product.price ?? '(assente)'}\nPeso: ${product.weight ?? '(assente)'}\nImmagine: ${product.image_link ?? '(assente)'}\nManufacturer ID: ${product.manufacturer_id ?? '(assente)'}`);

        // Abbinamento categoria gerarchica
        if (product.product_type) {
          product.category_id = await getOrCreateCategory(
            product.product_type,
            existingCategories,
            config.inventory.inventory_id
          );
        }

        // Controllo avanzato SKU
        const skuCheck = await checkSkuStatus(product.sku, config.inventory.inventory_id);

        if (skuCheck.status === 'AMBIGUOUS') {
          ambiguous++;
          log(`[BLOCKED] SKU ambiguo '${product.sku}': trovati ${skuCheck.count} prodotti su Base.com (${skuCheck.productIds.join(', ')}).`);
          continue;
        }

        if (skuCheck.status === 'VARIANT_EXISTS') {
          ambiguous++;
          log(`[BLOCKED] SKU '${product.sku}' appartiene a una variante esistente (ID Variante: ${skuCheck.productId}).`);
          continue;
        }

        if (skuCheck.status === 'EXISTS_SINGLE') {
          skipped++;
          log(`SKIPPED - SKU '${product.sku}' già presente univocamente (ID: ${skuCheck.productId})`);
          continue;
        }

        const result = await sendProductToBase(product, config);
        if (!result) {
          simulated++;
          continue;
        }
        imported++;
        log(`SUCCESS - product_id: ${result.product_id}`);
        if (result.warnings && Object.keys(result.warnings).length > 0) {
          log(`Avvisi Base.com: ${JSON.stringify(result.warnings)}`);
        }
      } catch (error) {
        errors++;
        log(`ERROR: ${error.message}`);
      }
    }
  } catch (error) {
    errors++;
    log(`ERROR ${stage}: ${error.message}`);
  } finally {
    log(`Prodotti letti: ${read} | Selezionati: ${selectedCount} | Processati: ${processed} | Importati: ${imported} | Saltati: ${skipped} | Bloccati/Ambigni: ${ambiguous} | Errori: ${errors}`);
    const { inventory, priceGroup, warehouse } = config;
    log(`\nInventory: ${inventory ? `${inventory.name} (${inventory.inventory_id})` : 'non selezionato'}`);
    log(`Gruppo prezzi: ${priceGroup ? `${priceGroup.name} (${priceGroup.price_group_id}, ${priceGroup.currency})` : 'non selezionato'}`);
    log(`Warehouse: ${warehouse ? `${warehouse.name} (${warehouse.id})` : warehouseStatus}`);
    log(`Prodotti letti: ${read}\nProdotti selezionati: ${selectedCount}\nProdotti processati: ${processed}\nImportati: ${imported}\nSaltati perché già presenti: ${skipped}\nSimulati: ${simulated}\nErrori: ${errors}`);
    if (errors > 0) process.exitCode = 1;
  }
}

main().catch(error => {
  log(`ERROR: ${error.message}`);
  process.exitCode = 1;
});