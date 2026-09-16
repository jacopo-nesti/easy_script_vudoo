import { dryRun, testMode } from './src/config.js';
import { getProducts, normalizeProduct, detectAndFilterDuplicates } from './src/products.js';
import { getBaseInventory, getBasePriceGroup, getBaseWarehouse, sendProductToBase, getBaseProductIdBySku } from './src/baseApi.js';
import { getCategoryMap, ensureCategoryPath, getManufacturerMap, ensureManufacturer } from './src/categories.js';
import { log } from './src/logger.js';

async function run() {
  log('--- INIZIO PROCEDURA DI IMPORTAZIONE ---');
  log(`[CONFIG] DRY_RUN = ${dryRun === 'true' ? 'ATTIVO (Nessuna scrittura su Base.com)' : 'DISATTIVATO'}`);
  log(`[CONFIG] TEST_MODE = ${testMode === 'true' ? 'ATTIVO (Verrà elaborato solo il 1° prodotto)' : 'DISATTIVATO'}\n`);

  // 1. Caricamento prodotti dal feed
  const rawProducts = await getProducts();
  
  // 2. Filtro duplicati in memoria
  const { uniqueProducts, duplicatesMap, hasDuplicates } = detectAndFilterDuplicates(rawProducts);

  if (hasDuplicates) {
    log(`[ATTENZIONE] Trovati ${duplicatesMap.size} SKU duplicati nel feed.`);
  }

  // 3. Gestione TEST_MODE
  const productsToProcess = testMode === 'true' ? uniqueProducts.slice(0, 1) : uniqueProducts;

  // 4. Inizializzazione configurazioni e mappe
  const inventory = await getBaseInventory();
  const priceGroup = await getBasePriceGroup(inventory);
  const warehouse = await getBaseWarehouse(inventory);
  const config = { inventory, priceGroup, warehouse };

  const categoryMap = await getCategoryMap(inventory.inventory_id);
  const manufacturerMap = await getManufacturerMap();

  let countCreated = 0;
  let countUpdated = 0;
  let countUnchanged = 0;
  let countErrors = 0;

  log(`Elaborazione di ${productsToProcess.length} prodotti in corso...\n`);

  // 5. Ciclo di importazione / aggiornamento
  for (const rawProduct of productsToProcess) {
    const sku = rawProduct.id ?? rawProduct.sku;

    try {
      const product = normalizeProduct(rawProduct);

      // Risoluzione / Creazione Categoria
      if (product.product_type) {
        product.category_id = await ensureCategoryPath(
          product.product_type,
          inventory.inventory_id,
          categoryMap
        );
      }

      // Risoluzione / Creazione Produttore
      if (product.brand) {
        product.manufacturer_id = await ensureManufacturer(
          product.brand,
          manufacturerMap
        );
      }

      // Verifica esistenza prodotto per scegliere tra Creazione o Aggiornamento
      const existingProductId = await getBaseProductIdBySku(sku, inventory.inventory_id);

      if (existingProductId) {
        const response = await sendProductToBase(product, config, existingProductId);
        
        // Logga solo se l'operazione ha apportato modifiche o se siamo in DRY_RUN
        log(`[AGGIORNAMENTO] Prodotto SKU: ${sku} (ID Base: ${existingProductId}) | Categoria ID: ${product.category_id ?? 'N/D'} | Produttore ID: ${product.manufacturer_id ?? 'N/D'}`);
        countUpdated++;
      } else {
        await sendProductToBase(product, config, null);
        
        log(`[CREAZIONE] Nuovo prodotto SKU: ${sku} | Categoria ID: ${product.category_id ?? 'N/D'} | Produttore ID: ${product.manufacturer_id ?? 'N/D'}`);
        countCreated++;
      }

    } catch (err) {
      log(`[ERRORE] Impossibile elaborare lo SKU "${sku}": ${err.message}`);
      countErrors++;
    }
  }

  log('\n--- ESITO IMPORTAZIONE ---');
  log(`Prodotti nuovi creati: ${countCreated}`);
  log(`Prodotti aggiornati: ${countUpdated}`);
  log(`Errori riscontrati: ${countErrors}`);
  log('--- FINE PROCEDURA ---');
}

run().catch(err => {
  log(`[ERRORE FATALE] ${err.message}`);
  process.exit(1);
});