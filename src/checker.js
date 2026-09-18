import { token, testMode, dryRun } from './config.js';
import { log } from './logger.js';
import { getBaseInventory, getBasePriceGroup, getBaseWarehouse } from './baseApi.js';
import { getProducts, detectAndFilterDuplicates } from './products.js';

export async function runEnvironmentCheck() {
  log('========================================');
  log('   DIAGNOSTICA AMBIENTE & CONFIGURAZIONE');
  log('========================================\n');

  let hasErrors = false;

  function report(title, success, details = '') {
    const icon = success ? '✅' : '❌';
    log(`${icon} ${title}${details ? ` -> ${details}` : ''}`);
    if (!success) hasErrors = true;
  }

  // 1. Variabili d'ambiente
  if (token) {
    report('BASE_API_TOKEN', true, '[TOKEN PRESENTE E NASCOSTO]');
  } else {
    report('BASE_API_TOKEN', false, 'Mancante o vuoto nel file .env');
  }

  const validTestMode = ['true', 'false'].includes(testMode);
  report('TEST_MODE', validTestMode, `${testMode} (valido: true/false)`);

  const validDryRun = ['true', 'false'].includes(dryRun);
  report('DRY_RUN', validDryRun, `${dryRun} (valido: true/false)`);

  // 2. Presenza e validazione real_products.json
  let products = null;
  try {
    products = await getProducts();
    report('File real_products.json', true, `${products.length} prodotti letti`);
  } catch (error) {
    report('File real_products.json', false, error.message);
  }

  // 3. Struttura e controllo duplicati sul JSON
  if (products) {
    try {
      const { uniqueProducts, feedDuplicates } = detectAndFilterDuplicates(products);
      report('Struttura JSON e Duplicati', true, `${uniqueProducts.length} unici, ${feedDuplicates} duplicati nel feed`);
    } catch (error) {
      report('Struttura JSON e Duplicati', false, error.message);
    }
  }

  // 4. Connessione API Base.com, Inventory, Price Group e Warehouse
  if (token && validTestMode && validDryRun) {
    try {
      const inventory = await getBaseInventory();
      report('Connessione Base.com & Inventory', true, `Catalogo "${inventory.name}" (ID: ${inventory.inventory_id})`);

      try {
        const priceGroup = await getBasePriceGroup(inventory);
        report('Price Group Base.com', true, `"${priceGroup.name}" (${priceGroup.currency}, ID: ${priceGroup.price_group_id})`);
      } catch (error) {
        report('Price Group Base.com', false, error.message);
      }

      try {
        const warehouse = await getBaseWarehouse(inventory);
        report('Warehouse Base.com', true, `"${warehouse.name}" (${warehouse.id})`);
      } catch (error) {
        report('Warehouse Base.com', false, error.message);
      }
    } catch (error) {
      report('Connessione Base.com & Inventory', false, error.message);
    }
  }

  log('\n========================================');
  if (hasErrors) {
    log('❌ DIAGNOSTICA FALLITA: Correggi gli errori sopra indicati.');
    return 1;
  }
  log('✅ DIAGNOSTICA COMPLETATA CON SUCCESSO!');
  return 0;
}