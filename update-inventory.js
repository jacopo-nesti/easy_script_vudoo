// update-inventory.js

import { log } from './src/logger.js';
import { callBase } from './src/baseApi.js';
import { buildBasePayload } from './src/products.js';

// Cerca il prodotto per SKU e restituisce l'intero oggetto o null se non trovato
export async function findProductInBase(sku, inventoryId) {
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
    const productSku = product.sku ?? product.ean;
    
    if (productSku === sku) {
      return {
        ...product,
        product_id: product.product_id ?? product.id ?? key
      };
    }
  }
  return null;
}

// Recupera i dettagli completi del prodotto da Base.com
export async function getBaseProductDetails(inventoryId, productId) {
  const data = await callBase('getInventoryProductsData', {
    inventory_id: inventoryId,
    products: [productId],
  });
  if (!data.products || !data.products[productId]) {
    throw new Error(`Impossibile recuperare i dati dettagliati per il prodotto ID ${productId}`);
  }
  return data.products[productId];
}

// Confronta i dati tra Vudoo e Base.com per vedere se ci sono differenze
export function hasProductChanged(newProduct, existingData) {
  const existingTitle = existingData.text_fields?.name ?? existingData.name ?? '';
  if (newProduct.title != null && String(newProduct.title) !== String(existingTitle)) {
    return true;
  }

  const existingDesc = existingData.text_fields?.description ?? existingData.description ?? '';
  if (newProduct.description != null && String(newProduct.description) !== String(existingDesc)) {
    return true;
  }

  if (newProduct.price != null) {
    const existingPrices = existingData.prices ?? {};
    const existingPrice = Object.values(existingPrices)[0]; 
    if (existingPrice != null && Number(existingPrice) !== Number(newProduct.price)) {
      return true;
    }
  }

  if (newProduct.ean != null && String(newProduct.ean) !== String(existingData.ean ?? '')) {
    return true;
  }

  if (newProduct.weight != null && Number(newProduct.weight) !== Number(existingData.weight ?? 0)) {
    return true;
  }

  if (newProduct.image_link != null) {
    const existingImages = existingData.images ?? {};
    const firstExistingImage = Object.values(existingImages)[0] ?? '';
    const formattedNewImage = `url:${newProduct.image_link}`;
    if (firstExistingImage !== formattedNewImage && !firstExistingImage.includes(newProduct.image_link)) {
      return true;
    }
  }

  return false;
}

// Aggiorna un prodotto esistente su Base.com
export async function updateProductInBase(productId, product, config, dryRun) {
  // Nota: se buildBasePayload serve qui, assicurati di importarlo se necessario
  // (al momento usava il parametro, ora sfrutta gli import o la logica esistente)
  const payload = buildBasePayload(product, config);
  payload.product_id = productId;

  if (dryRun === 'true') {
    log(`Payload Base.com (Aggiornamento Prodotto ID ${productId}):\n${JSON.stringify(payload, null, 2)}`);
    log('DRY_RUN: nessuna modifica reale su Base.com');
    return null;
  }
  return await callBase('addInventoryProduct', payload);
}