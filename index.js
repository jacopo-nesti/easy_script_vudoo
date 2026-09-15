import { readFile } from 'node:fs/promises';

const token = process.env.BASE_API_TOKEN?.trim();
const inventoryId = process.env.BASE_INVENTORY_ID?.trim();
const warehouseId = process.env.BASE_WAREHOUSE_ID?.trim();
const testMode = process.env.TEST_MODE ?? 'true';
const dryRun = process.env.DRY_RUN ?? 'true';

function log(message) {
  const text = String(message);
  console.log(token ? text.replaceAll(token, '[TOKEN NASCOSTO]') : text);
}

async function callBase(method, parameters = {}) {
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

async function getBaseInventory() {
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

async function getBasePriceGroup(inventory) {
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

async function getBaseWarehouse(inventory) {
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

async function getProducts() {
  const content = await readFile(new URL('./real_products.json', import.meta.url), 'utf8');
  const products = JSON.parse(content.replace(/^\uFEFF/, ''));
  if (!Array.isArray(products)) {
    throw new Error('real_products.json deve contenere un array di prodotti.');
  }
  return products;
}

function parseFeedNumber(value, unit, field) {
  if (typeof value !== 'string' || !value.trim().endsWith(unit)) {
    throw new Error(`${field} deve essere una stringa con unita ${unit}.`);
  }
  const text = value.trim().slice(0, -unit.length).replace(/\s/g, '').replace(',', '.');
  const number = Number(text);
  if (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(number)) {
    throw new Error(`${field} contiene un numero non valido.`);
  }
  return number;
}

function normalizeProduct(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Il prodotto deve essere un oggetto JSON.');
  }
  const normalized = { ...source };
  for (const field of ['id', 'ean', 'mpn', 'title', 'brand', 'condition', 'description',
    'image_link', 'link', 'product_type', 'availability', 'pickup_SLA']) {
    if (source[field] != null && typeof source[field] !== 'string') {
      throw new Error(`${field} deve essere una stringa.`);
    }
  }
  if (source.id != null) normalized.sku = source.id;
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
  if (source.quantity != null &&
    (typeof source.quantity !== 'number' || !Number.isFinite(source.quantity) || source.quantity < 0)) {
    throw new Error('quantity deve essere un numero maggiore o uguale a zero.');
  }
  return normalized;
}

function buildBasePayload(product, config) {
  const payload = { inventory_id: config.inventory.inventory_id };
  for (const field of ['sku', 'ean', 'weight']) {
    if (product[field] != null) payload[field] = product[field];
  }

  const textFields = {};
  if (product.title != null) textFields.name = product.title;
  if (product.description != null) textFields.description = product.description;
  if (Object.keys(textFields).length > 0) payload.text_fields = textFields;

  if (product.price != null) {
    if (config.priceGroup.currency !== 'EUR') {
      throw new Error('Il feed contiene prezzi EUR ma il gruppo prezzi Base.com ha una valuta diversa.');
    }
    payload.prices = { [config.priceGroup.price_group_id]: product.price };
  }
  if (product.quantity != null) {
    if (!config.warehouse) throw new Error('Magazzino mancante per la quantita.');
    payload.stock = { [config.warehouse.id]: product.quantity };
  }
  if (product.image_link != null) {
    if (!URL.canParse(product.image_link) || !['http:', 'https:'].includes(new URL(product.image_link).protocol)) {
      throw new Error('image_link deve essere un URL HTTP o HTTPS valido.');
    }
    payload.images = { '0': `url:${product.image_link}` };
  }
  return payload;
}

// sostituito productExistsInBase con findProductInBase
// ora la funzione cerca il prodotto per SKU e restituisce l'intero oggetto (con product_id) o null se non trovato
async function findProductInBase(sku, inventoryId) {
  if (typeof sku !== 'string' || sku.trim() === '') {
    throw new Error('Ricerca prodotto: SKU mancante o non valido.');
  }

  log(`[DEBUG API] Ricerca SKU "${sku}" nell'Inventory ID: ${inventoryId}`);

  const data = await callBase('getInventoryProductsList', {
    inventory_id: inventoryId,
    filter_sku: sku,
  });

  log(`[DEBUG API] Risposta getInventoryProductsList ricevuta per SKU ${sku}: ${JSON.stringify(data.products)}`);

  if (!data.products || typeof data.products !== 'object') {
    throw new Error('getInventoryProductsList: elenco prodotti non valido.');
  }
  for (const [key, product] of Object.entries(data.products)) {
    if (!product) continue;
    // Verifichiamo lo SKU
    const productSku = product.sku ?? product.ean; // fallback sicuro se serve
    
    // Verifica che lo SKU corrisponda esattamente
    if (productSku === sku) {
      return {
        ...product,
        product_id: product.product_id ?? product.id ?? key
      };
    }
  }
  return null; // restituisce null se il prodotto non esiste
}

// aggiunta funzione per recuperare i dettagli completi del prodotto da Base.com
// serve per ottenere lo stato attuale di prezzo, titolo, descrizione, EAN, peso, immagini, ecc.
async function getBaseProductDetails(inventoryId, productId) {
  const data = await callBase('getInventoryProductsData', {
    inventory_id: inventoryId,
    products: [productId],
  });
  if (!data.products || !data.products[productId]) {
    throw new Error(`Impossibile recuperare i dati dettagliati per il prodotto ID ${productId}`);
  }
  return data.products[productId];
}

// aggiunta funzione per confrontare i dati tra Vudoo e Base.com
// verifica se prezzo, titolo, descrizione, EAN, peso o immagini sono differenti.
function hasProductChanged(newProduct, existingData) {
  // 1. Confronto Titolo (in Base.com i campi testuali sono dentro text_fields.name o name a seconda della struttura API)
  const existingTitle = existingData.text_fields?.name ?? existingData.name ?? '';
  if (newProduct.title != null && String(newProduct.title) !== String(existingTitle)) {
    return true;
  }

  // 2. Confronto Descrizione
  const existingDesc = existingData.text_fields?.description ?? existingData.description ?? '';
  if (newProduct.description != null && String(newProduct.description) !== String(existingDesc)) {
    return true;
  }

  // 3. Confronto Prezzo (gestito nel gruppo prezzi predefinito)
  if (newProduct.price != null) {
    // I prezzi su Base.com sono solitamente dentro l'oggetto prices { [price_group_id]: valore }
    const existingPrices = existingData.prices ?? {};
    // Viene cercato il prezzo nel gruppo prezzi attivo
    const existingPrice = Object.values(existingPrices)[0]; 
    if (existingPrice != null && Number(existingPrice) !== Number(newProduct.price)) {
      return true;
    }
  }

  // 4. Confronto EAN
  if (newProduct.ean != null && String(newProduct.ean) !== String(existingData.ean ?? '')) {
    return true;
  }

  // 5. Confronto Peso
  if (newProduct.weight != null && Number(newProduct.weight) !== Number(existingData.weight ?? 0)) {
    return true;
  }

  // 6. Confronto Immagini (verifica se l'immagine principale è cambiata)
  if (newProduct.image_link != null) {
    const existingImages = existingData.images ?? {};
    // Base.com restituisce le immagini come oggetto o array, viene verificata la prima (chiave '0' o valore)
    const firstExistingImage = Object.values(existingImages)[0] ?? '';
    const formattedNewImage = `url:${newProduct.image_link}`;
    if (firstExistingImage !== formattedNewImage && !firstExistingImage.includes(newProduct.image_link)) {
      return true;
    }
  }

  return false; // Nessuna differenza rilevata, l'aggiornamento non è necessario
}

// Aggiunta funzione per aggiornare un prodotto esistente su Base.com
// Invia il payload includendo il product_id per effettuare l'aggiornamento dei dati modificati.
async function updateProductInBase(productId, product, config) {
  const payload = buildBasePayload(product, config);
  payload.product_id = productId; // Viene specificato l'ID del prodotto esistente per aggiornarlo

  if (dryRun === 'true') {
    log(`Payload Base.com (Aggiornamento Prodotto ID ${productId}):\n${JSON.stringify(payload, null, 2)}`);
    log('DRY_RUN: nessuna modifica reale su Base.com');
    return null;
  }
  return await callBase('addInventoryProduct', payload);
}

async function sendProductToBase(product, config) {
  const payload = buildBasePayload(product, config);
  if (dryRun === 'true') {
    log(`Payload Base.com (addInventoryProduct):\n${JSON.stringify(payload, null, 2)}`);
    log('DRY_RUN: nessuna scrittura su Base.com');
    return null;
  }
  return await callBase('addInventoryProduct', payload);
}

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
        log(`[DEBUG] Normalizzazione completata\nProdotto normalizzato:\n${JSON.stringify(product, null, 2)}`);
        log(`SKU: ${product.sku ?? '(assente)'}\nNome: ${product.title ?? '(assente)'}\nEAN: ${product.ean ?? '(assente)'}\nPrezzo: ${product.price ?? '(assente)'}\nPeso: ${product.weight ?? '(assente)'}\nImmagine: ${product.image_link ?? '(assente)'}`);
        
        // Gestione intelligente (Controllo esistenza -> Recupero dati -> Confronto -> Aggiornamento o Skip)
        const existingProduct = await findProductInBase(product.sku, config.inventory.inventory_id);
        if (existingProduct) {
          // Il prodotto esiste: recuperiamo i dati attuali da Base.com per confrontarli
          const existingDetails = await getBaseProductDetails(config.inventory.inventory_id, existingProduct.product_id);
          
          if (hasProductChanged(product, existingDetails)) {
            log(`Rilevate modifiche per SKU ${product.sku}. Procedo con l'aggiornamento...`);
            const result = await updateProductInBase(existingProduct.product_id, product, config);
            if (!result) {
              simulated++;
              continue;
            }
            imported++; // Viene conteggiato l'aggiornamento come operazione completata con successo
            log(`SUCCESS (Aggiornato) - product_id: ${existingProduct.product_id}`);
          } else {
            skipped++;
            log(`SKIPPED - SKU ${product.sku} già presente e nessun dato modificato (nessun aggiornamento necessario)`);
          }
          continue;
        }

        // Se il prodotto non esiste, si procede alla creazione da capo
        const result = await sendProductToBase(product, config);
        if (!result) {
          simulated++;
          continue;
        }
        imported++;
        log(`SUCCESS (Creato) - product_id: ${result.product_id}`);

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
