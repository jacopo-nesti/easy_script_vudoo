import { readFile } from 'node:fs/promises';

export async function getProducts() {
  const content = await readFile(new URL('../real_products.json', import.meta.url), 'utf8');
  const products = JSON.parse(content.replace(/^\uFEFF/, ''));
  if (!Array.isArray(products)) {
    throw new Error('real_products.json deve contenere un array di prodotti.');
  }
  return products;
}

export function parseFeedNumber(value, unit, field) {
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

export function normalizeProduct(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Il prodotto deve essere un oggetto JSON.');
  }
  const normalized = { ...source };

  if (!source.id || typeof source.id !== 'string' || source.id.trim() === '') {
    throw new Error('Validazione fallita: SKU mancante.');
  }
  if (!source.title || typeof source.title !== 'string' || source.title.trim() === '') {
    throw new Error('Validazione fallita: Titolo mancante.');
  }
  if (!source.price || typeof source.price !== 'string' || source.price.trim() === '') {
    throw new Error('Validazione fallita: Prezzo mancante.');
  }

  for (const field of ['id', 'ean', 'mpn', 'title', 'brand', 'condition', 'description',
    'image_link', 'link', 'product_type', 'availability', 'pickup_SLA']) {
    if (source[field] != null && typeof source[field] !== 'string') {
      throw new Error(`${field} deve essere una stringa.`);
    }
  }

  if (source.ean != null) {
    normalized.ean = source.ean.replace(/\s+/g, '');
    if (normalized.ean !== '' && !/^\d{8,14}$/.test(normalized.ean)) {
      throw new Error(`Validazione fallita: EAN non valido (${source.ean}).`);
    }
  }
  
  if (source.image_link != null) {
    if (!URL.canParse(source.image_link) || !['http:', 'https:'].includes(new URL(source.image_link).protocol)) {
      throw new Error(`Validazione fallita: URL immagine non valido (${source.image_link}).`);
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

export function buildBasePayload(product, config) {
  const payload = { inventory_id: config.inventory.inventory_id };

  for (const field of ['sku', 'ean', 'weight']) {
    if (product[field] != null) payload[field] = product[field];
  }

  // Assegnazione ID Produttore
  const parsedManufacturerId = parseInt(product.manufacturer_id, 10);
  if (!isNaN(parsedManufacturerId) && parsedManufacturerId > 0) {
    payload.manufacturer_id = parsedManufacturerId;
  }

  // Assegnazione ID Categoria
  const parsedCategoryId = parseInt(product.category_id, 10);
  if (!isNaN(parsedCategoryId) && parsedCategoryId > 0) {
    payload.category_id = parsedCategoryId;
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
    payload.stock = { default: product.quantity };
  }
  if (product.image_link != null) {
    if (!URL.canParse(product.image_link) || !['http:', 'https:'].includes(new URL(product.image_link).protocol)) {
      throw new Error('image_link deve essere un URL HTTP o HTTPS valido.');
    }
    payload.images = { '0': `url:${product.image_link}` };
  }
  return payload;
}

export function detectAndFilterDuplicates(products) {
  const seenSkus = new Set();
  const duplicatesMap = new Map();
  const uniqueProducts = [];

  for (const product of products) {
    const sku = product.id ?? product.sku;
    if (!sku) continue;

    if (seenSkus.has(sku)) {
      const count = duplicatesMap.get(sku) ?? 1;
      duplicatesMap.set(sku, count + 1);
    } else {
      seenSkus.add(sku);
      uniqueProducts.push(product);
    }
  }

  return {
    uniqueProducts,
    duplicatesMap,
    hasDuplicates: duplicatesMap.size > 0
  };
}