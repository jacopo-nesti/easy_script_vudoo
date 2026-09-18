import { token, inventoryId, warehouseId, dryRun } from './config.js';
import { log } from './logger.js';
import { buildBasePayload, buildBaseUpdatePayload } from './products.js';

export async function callBase(method, parameters = {}) {
  if (!['true', 'false'].includes(dryRun)) throw new Error('DRY_RUN deve essere true oppure false.');
  if (dryRun === 'true' && !method.startsWith('get')) {
    throw new Error(`DRY_RUN: scrittura ${method} bloccata.`);
  }
  const response = await fetch('https://api.baselinker.com/connector.php', {
    method: 'POST',
    headers: { 'X-BLToken': token },
    body: new URLSearchParams({ method, parameters: JSON.stringify(parameters) }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`${method}: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'SUCCESS') {
    throw new Error(`${method}: ${data.error_code ?? 'ERROR'} - ${data.error_message ?? 'Risposta API non valida'}`);
  }
  return data;
}

export async function getBaseInventory() {
  const data = await callBase('getInventories');
  log('[DEBUG] Chiamata getInventories completata');
  if (!Array.isArray(data.inventories) || data.inventories.length === 0) {
    throw new Error('getInventories: nessun catalogo trovato su Base.com.');
  }
  log(`[DEBUG] Inventory disponibili: ${data.inventories.length}`);

  if (inventoryId) {
    const inventory = data.inventories.find(item => String(item.inventory_id) === inventoryId);
    if (inventory) return inventory;
    throw new Error(`BASE_INVENTORY_ID=${inventoryId} non trovato; nessun catalogo alternativo selezionato.`);
  }

  const defaults = data.inventories.filter(inventory => inventory.is_default === true);
  if (defaults.length !== 1) throw new Error('Inventory Default non identificabile in modo univoco.');
  const defaultInventory = defaults[0];
  log(`[DEBUG] Catalogo selezionato automaticamente (default): ${defaultInventory.name} (ID: ${defaultInventory.inventory_id})`);
  return defaultInventory;
}

export async function getBasePriceGroup(inventory) {
  const data = await callBase('getInventoryPriceGroups');
  if (!Array.isArray(data.price_groups) || !Array.isArray(inventory.price_groups)) {
    throw new Error('Elenco gruppi prezzi non valido.');
  }
  const priceGroups = data.price_groups.filter(priceGroup =>
    inventory.price_groups.some(id => String(id) === String(priceGroup.price_group_id))
  );
  const defaults = priceGroups.filter(priceGroup =>
    inventory.default_price_group != null
      ? String(priceGroup.price_group_id) === String(inventory.default_price_group)
      : priceGroup.is_default === true
  );
  if (defaults.length !== 1) {
    for (const priceGroup of priceGroups) {
      log(`Gruppo prezzi disponibile: ${priceGroup.name} (${priceGroup.currency}) - ID: ${priceGroup.price_group_id}`);
    }
    throw new Error('Gruppo prezzi predefinito non identificabile. Indica quale usare; nessuna importazione eseguita.');
  }
  const priceGroup = defaults[0];
  log(`Gruppo prezzi predefinito: ${priceGroup.name} (${priceGroup.currency})\nprice_group_id: ${priceGroup.price_group_id}`);
  return priceGroup;
}
export async function getBaseWarehouse(inventory) {
  // Forza l'uso del magazzino configurato nel file .env
  if (warehouseId) {
    return {
      id: warehouseId,
      name: "Wally 1925"
    };
  }

  // Fallback di sicurezza nel caso in cui l'ID non sia definito
  return null;
}
  // Altrimenti, eventuale logica originale di ricerca...
  // (se c'era un fetch dalle API, puoi lasciarlo come fallback o sostituirlo del tutto)


export async function productExistsInBase(sku, inventoryId) {
  return (await findProductInBase(sku, inventoryId)) !== null;
}

export async function findProductInBase(sku, inventoryId) {
  if (typeof sku !== 'string' || sku.trim() === '') {
    throw new Error('Controllo duplicati: SKU mancante o non valido.');
  }
  const data = await callBase('getInventoryProductsList', {
    inventory_id: inventoryId,
    filter_sku: sku,
    include_variants: true,
  });
  if (!data.products || typeof data.products !== 'object') {
    throw new Error('getInventoryProductsList: elenco prodotti non valido.');
  }
  let match = null;
  for (const [key, product] of Object.entries(data.products)) {
    if (!product || typeof product.sku !== 'string') {
      throw new Error('getInventoryProductsList: prodotto senza SKU valido nella risposta.');
    }
    if (product.sku !== sku) continue;
    if (match) throw new Error(`SKU ${sku} ambiguo: piu prodotti presenti nel catalogo.`);
    const id = Number(product.id ?? product.product_id ?? key);
    if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== key) {
      throw new Error('Identita prodotto non valida nella risposta Base.com.');
    }
    match = { ...product, product_id: id };
  }
  return match;
}

export async function getBaseProductDetails(inventoryId, productId) {
  const data = await callBase('getInventoryProductsData', { inventory_id: inventoryId, products: [productId] });
  const product = data.products?.[productId];
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    throw new Error(`Dettagli del prodotto ${productId} mancanti.`);
  }
  return product;
}

export async function updateProductInBase(productId, product, config, existing) {
  if (!Number.isSafeInteger(Number(productId)) || Number(productId) <= 0) throw new Error('product_id UPDATE non valido.');
  const details = existing ?? await getBaseProductDetails(config.inventory.inventory_id, productId);
  const changes = buildBaseUpdatePayload(product, details, config);
  if (!changes) return null;
  const payload = { ...changes, product_id: Number(productId) };
  if (dryRun === 'true') {
    log(`Payload Base.com (UPDATE):\n${JSON.stringify(payload, null, 2)}`);
    log('DRY_RUN: nessuna scrittura su Base.com');
    return null;
  }
  return await callBase('addInventoryProduct', payload);
}

export async function sendProductToBase(product, config) {
  const payload = buildBasePayload(product, config);
  if (dryRun === 'true') {
    log(`Payload Base.com (addInventoryProduct):\n${JSON.stringify(payload, null, 2)}`);
    log('DRY_RUN: nessuna scrittura su Base.com');
    return null;
  }
  return await callBase('addInventoryProduct', payload);
}
