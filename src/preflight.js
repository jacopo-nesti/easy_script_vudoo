import { token, testMode, dryRun } from './config.js';
import { getBaseInventory, getBasePriceGroup, getBaseWarehouse } from './baseApi.js';
import { getProducts, detectAndFilterDuplicates } from './products.js';
import { log } from './logger.js';

export async function runPreflightCheck() {
  log('[PREFLIGHT] Avvio controlli preliminari...');

  // 1. Verifica token e flag di configurazione
  if (!token) {
    throw new Error('[PREFLIGHT] BASE_API_TOKEN mancante o vuoto nel file .env.');
  }

  if (!['true', 'false'].includes(testMode) || !['true', 'false'].includes(dryRun)) {
    throw new Error('[PREFLIGHT] TEST_MODE e DRY_RUN devono essere impostati su "true" oppure "false".');
  }

  // 2. Lettura e validazione struttura real_products.json
  let rawProducts;
  try {
    rawProducts = await getProducts();
  } catch (error) {
    throw new Error(`[PREFLIGHT] Il file real_products.json non è presente o non è leggibile.\n👉 Esegui prima l'opzione 2 (Converti XML → JSON) per generare il file dal feed Vudoo.`);
  }

  if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
    throw new Error('[PREFLIGHT] real_products.json è vuoto o non contiene prodotti validi. Esegui la conversione XML → JSON (Opzione 2).');
  }

  // 3. Selezione prodotti e filtro duplicati preliminare
  const candidates = testMode === 'true' ? rawProducts.slice(0, 1) : rawProducts;
  const { uniqueProducts, duplicatesMap } = detectAndFilterDuplicates(candidates);

  let feedDuplicates = 0;
  if (duplicatesMap && typeof duplicatesMap.values === 'function') {
    for (const count of duplicatesMap.values()) {
      feedDuplicates += count - 1;
    }
  }

  // 4. Verifica risorse Base.com: Inventory di default e Price Group
  const inventory = await getBaseInventory();
  if (!inventory) {
    throw new Error('[PREFLIGHT] Impossibile recuperare l\'inventory Default su Base.com.');
  }

  const priceGroup = await getBasePriceGroup(inventory);
  if (!priceGroup) {
    throw new Error('[PREFLIGHT] Price group necessario non trovato su Base.com.');
  }

  // 5. Verifica Warehouse SOLO quando richiesto dallo stock dei prodotti
  let warehouse = null;
  const requiresWarehouse = uniqueProducts.some(product => product?.quantity != null);

  if (requiresWarehouse) {
    warehouse = await getBaseWarehouse(inventory);
    if (!warehouse) {
      throw new Error('[PREFLIGHT] Warehouse necessario per la gestione dello stock ma non disponibile su Base.com.');
    }
  }

  log('[PREFLIGHT] Controlli preliminari completati con successo! ✅\n');

  return {
    inventory,
    priceGroup,
    warehouse,
    products: rawProducts,
    selectedProducts: uniqueProducts,
    feedDuplicates
  };
}