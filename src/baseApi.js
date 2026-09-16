import { token, inventoryId, warehouseId, dryRun } from './config.js';
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
  log('[DEBUG] Chiamata getInventories completata');
  if (!Array.isArray(data.inventories)) {
    throw new Error('getInventories: elenco cataloghi non valido.');
  }
  log(`[DEBUG] Inventory disponibili: ${data.inventories.length}`);
  for (const inventory of data.inventories) {
    log(`Catalogo trovato: ${inventory.name}\ninventory_id: ${inventory.inventory_id}`);
  }
  if (inventoryId) {
    const inventory = data.inventories.find(item => String(item.inventory_id) === inventoryId);
    if (!inventory) {
      throw new Error(`BASE_INVENTORY_ID=${inventoryId} non trovato. Gli inventory disponibili sono elencati sopra.`);
    }
    return inventory;
  }
  if (data.inventories.length !== 1) {
    throw new Error('Senza BASE_INVENTORY_ID serve un solo catalogo. Imposta nel .env uno degli ID disponibili; nessuna importazione eseguita.');
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
  const data = await callBase('getInventoryWarehouses');
  if (!Array.isArray(data.warehouses) || !Array.isArray(inventory.warehouses)) {
    throw new Error('Elenco magazzini non valido.');
  }
  const warehouses = data.warehouses.filter(warehouse =>
    warehouse.warehouse_type === 'bl' &&
    inventory.warehouses.includes(`bl_${warehouse.warehouse_id}`)
  );
  let warehouse;
  if (warehouseId) {
    warehouse = warehouses.find(item => `bl_${item.warehouse_id}` === warehouseId);
    if (!warehouse) {
      throw new Error(`BASE_WAREHOUSE_ID=${warehouseId} non trovato tra i magazzini Base restituiti dall'API e associati al catalogo selezionato.`);
    }
  } else if (warehouses.length !== 1) {
    for (const warehouse of warehouses) {
      log(`Magazzino utilizzabile: ${warehouse.name} - ID: bl_${warehouse.warehouse_id}`);
    }
    throw new Error('Serve un solo magazzino Base associato al catalogo per inviare le quantita. Se ce ne sono diversi, indica quello corretto.');
  } else {
    warehouse = warehouses[0];
  }
  return { name: warehouse.name, id: `bl_${warehouse.warehouse_id}` };
}

export async function productExistsInBase(sku, inventoryId) {
  if (typeof sku !== 'string' || sku.trim() === '') {
    throw new Error('Controllo duplicati: SKU mancante o non valido.');
  }
  const data = await callBase('getInventoryProductsList', {
    inventory_id: inventoryId,
    filter_sku: sku,
  });
  if (!data.products || typeof data.products !== 'object') {
    throw new Error('getInventoryProductsList: elenco prodotti non valido.');
  }
  for (const product of Object.values(data.products)) {
    if (!product || typeof product.sku !== 'string') {
      throw new Error('getInventoryProductsList: prodotto senza SKU valido nella risposta.');
    }
    if (product.sku === sku) return true;
  }
  return false;
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
export async function checkSkuStatus(sku, inventoryId) {
  const response = await callBase('getInventoryProductsList', {
    inventory_id: inventoryId,
    filter_sku: sku
  });

  const matches = Object.values(response.products || {});

  if (matches.length === 0) {
    return { status: 'ABSENT' };
  }

  if (matches.length === 1) {
    const item = matches[0];
    const isVariant = Boolean(item.parent_id && item.parent_id !== 0);
    return {
      status: isVariant ? 'VARIANT_EXISTS' : 'EXISTS_SINGLE',
      productId: item.id,
      parentId: item.parent_id || null
    };
  }

  return {
    status: 'AMBIGUOUS',
    count: matches.length,
    productIds: matches.map(p => p.id)
  };
}