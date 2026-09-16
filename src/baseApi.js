import { token, inventoryId, dryRun } from './config.js';
import { log } from './logger.js';
import { buildBasePayload } from './products.js';

export async function callBase(method, parameters = {}) {
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
  if (!Array.isArray(data.inventories) || data.inventories.length === 0) {
    throw new Error('getInventories: nessun catalogo trovato su Base.com.');
  }

  if (inventoryId) {
    const inventory = data.inventories.find(item => String(item.inventory_id) === inventoryId);
    if (inventory) return inventory;
  }

  return data.inventories[0];
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
    throw new Error('Gruppo prezzi predefinito non identificabile.');
  }
  return defaults[0];
}

export async function getBaseWarehouse(inventory) {
  return { name: 'Default Warehouse', id: 'default' };
}

export async function getBaseProductIdBySku(sku, inventoryId) {
  if (!sku || typeof sku !== 'string' || sku.trim() === '') {
    return null;
  }

  const data = await callBase('getInventoryProductsList', {
    inventory_id: inventoryId,
    filter_sku: sku.trim(),
  });

  if (!data.products || typeof data.products !== 'object') {
    return null;
  }

  const productsList = Object.entries(data.products);
  if (productsList.length === 0) {
    return null;
  }

  const match = productsList.find(([_, p]) => p && p.sku && p.sku.trim() === sku.trim());
  return match ? match[0] : null;
}

export async function sendProductToBase(product, config, existingProductId = null) {
  const payload = buildBasePayload(product, config);

  if (existingProductId) {
    payload.product_id = existingProductId;
  }

  log(`[DEBUG PAYLOAD] Sending category_id: ${payload.category_id ?? 'nessuna'} per SKU: ${payload.sku}`);

  if (dryRun === 'true') {
    log(`[DRY_RUN] Payload Base.com:\n${JSON.stringify(payload, null, 2)}`);
    return null;
  }

  return await callBase('addInventoryProduct', payload);
}