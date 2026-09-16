import { getProducts, normalizeProduct, detectAndFilterDuplicates } from './src/products.js';
import { getBaseInventory, getBasePriceGroup, getBaseWarehouse, sendProductToBase, getBaseProductIdBySku } from './src/baseApi.js';
import { getCategoryMap, ensureCategoryPath, getManufacturerMap, ensureManufacturer } from './src/categories.js';
import { log } from './src/logger.js';

async function run() {
  log('--- INIZIO PROCEDURA DI IMPORTAZIONE ---');

  const rawProducts = await getProducts();
  log(`Letti ${rawProducts.length} prodotti totali dal feed.`);

  const { uniqueProducts, duplicatesMap, hasDuplicates } = detectAndFilterDuplicates(rawProducts);

  if (hasDuplicates) {
    log(`[ATTENZIONE] Trovati ${duplicatesMap.size} SKU duplicati nel feed.`);
  }

  const inventory = await getBaseInventory();
  const priceGroup = await getBasePriceGroup(inventory);
  const warehouse = await getBaseWarehouse(inventory);
  const config = { inventory, priceGroup, warehouse };

  // Caricamento Categorie e Produttori
  const categoryMap = await getCategoryMap(inventory.inventory_id);
  const manufacturerMap = await getManufacturerMap();

  let countCreated = 0;
  let countUpdated = 0;
  let countErrors = 0;

  log(`\nInizio elaborazione di ${uniqueProducts.length} prodotti unici...\n`);

  for (const rawProduct of uniqueProducts) {
    const sku = rawProduct.id ?? rawProduct.sku;

    try {
      const product = normalizeProduct(rawProduct);

      // 1. Risoluzione / Creazione Categoria
      if (product.product_type) {
        product.category_id = await ensureCategoryPath(
          product.product_type,
          inventory.inventory_id,
          categoryMap
        );
      }

      // 2. Risoluzione / Creazione Produttore (da campo "brand")
      if (product.brand) {
        product.manufacturer_id = await ensureManufacturer(
          product.brand,
          manufacturerMap
        );
      }

      // 3. Controllo presenza e invio su Base.com
      const existingProductId = await getBaseProductIdBySku(sku, inventory.inventory_id);

      if (existingProductId) {
        log(`[AGGIORNAMENTO] SKU: ${sku} | Categoria ID: ${product.category_id ?? 'N/D'} | Produttore ID: ${product.manufacturer_id ?? 'N/D'}`);
        await sendProductToBase(product, config, existingProductId);
        countUpdated++;
      } else {
        log(`[CREAZIONE] SKU: ${sku} | Categoria ID: ${product.category_id ?? 'N/D'} | Produttore ID: ${product.manufacturer_id ?? 'N/D'}`);
        await sendProductToBase(product, config, null);
        countCreated++;
      }

    } catch (err) {
      log(`[ERRORE] Impossibile elaborare lo SKU "${sku}": ${err.message}`);
      countErrors++;
    }
  }

  log('\n--- ESITO IMPORTAZIONE ---');
  log(`Prodotti nuovi creati: ${countCreated}`);
  log(`Prodotti esistenti aggiornati: ${countUpdated}`);
  log(`Errori riscontrati: ${countErrors}`);
  log('--- FINE PROCEDURA ---');
}

run().catch(err => {
  log(`[ERRORE FATALE] ${err.message}`);
  process.exit(1);
});