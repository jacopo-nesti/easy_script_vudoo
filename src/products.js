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
  let text = value.trim().slice(0, -unit.length).trim();
  if (text.includes(',')) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(text)) {
      throw new Error(`${field} contiene un numero non valido (${value}).`);
    }
    text = text.replace(/\./g, '').replace(',', '.');
  }
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

  // +++ BLOCCO 1: Controllo severo campi obbligatori +++
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

  // +++ BLOCCO 2: Pulizia spazi EAN e check sintassi URL +++
  if (source.ean != null) {
    normalized.ean = source.ean.replace(/\s+/g, ''); // Rimuove gli spazi anomali
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
  const quantityMissing = source.quantity == null ||
    (typeof source.quantity === 'string' && source.quantity.trim() === '');

  if (!quantityMissing) {
    const quantity = typeof source.quantity === 'string'
      ? Number(source.quantity.trim())
      : source.quantity;
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error('quantity deve essere un numero maggiore o uguale a zero.');
    }
    normalized.quantity = quantity;
  } else {
    const availability = source.availability?.trim().toLowerCase();
    if (availability === 'in stock') normalized.quantity = 10;
    else if (availability === 'out of stock') normalized.quantity = 0;
    else delete normalized.quantity;
  }
  return normalized;
}

export function sanitizeTextForBase(text) {
  return text.replace(/ *(?:[\u{10000}-\u{10FFFF}][\uFE0E\uFE0F]? *)+/gu, (removed, offset) => {
    const before = text[offset - 1];
    const after = text[offset + removed.length];
    return removed.includes(' ') && before && after && !/[\r\n]/.test(before + after) ? ' ' : '';
  });
}

export function buildBasePayload(product, config) {
  const payload = { inventory_id: config.inventory.inventory_id };
  for (const field of ['sku', 'ean', 'weight']) {
    if (product[field] != null) payload[field] = product[field];
  }

  // Aggiunta dell'ID Produttore nel payload se presente
  for (const field of ['manufacturer_id', 'category_id']) {
    if (product[field] == null) continue;
    const id = Number(product[field]);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${field} non valido.`);
    payload[field] = id;
  }

  const textFields = {};
  if (product.title != null) textFields.name = sanitizeTextForBase(product.title);
  if (product.description != null) textFields.description = sanitizeTextForBase(product.description);
  if (Object.keys(textFields).length > 0) payload.text_fields = textFields;

  if (product.price != null) {
    if (config.priceGroup.currency !== 'EUR') {
      throw new Error('Il feed contiene prezzi EUR ma il gruppo prezzi Base.com ha una valuta diversa.');
    }
    payload.prices = { [config.priceGroup.price_group_id]: product.price };
  }
  if (product.quantity != null) {
    if (!config.warehouse || !/^bl_\d+$/.test(config.warehouse.id)) {
      throw new Error('Magazzino Base valido mancante per la quantita.');
    }
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

export function detectAndFilterDuplicates(products) {
    const seenSkus = new Set();
    const duplicatesMap = new Map();
    const uniqueProducts = [];

    for (const product of products) {
      const sku = product?.id;
      if (typeof sku !== 'string' || sku.trim() === '') {
        uniqueProducts.push(product);
        continue;
      }

      if (seenSkus.has(sku)) {
        const first = uniqueProducts.find(item => item?.id === sku);
        for (const field of ['title', 'description', 'price', 'ean', 'weight', 'quantity', 'image_link', 'brand', 'product_type', 'manufacturer_id', 'category_id']) {
          if (JSON.stringify(first[field] ?? null) !== JSON.stringify(product[field] ?? null)) {
            throw new Error(`SKU duplicato ${sku} con valori discordanti: ${field}.`);
          }
        }
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

export function buildBaseUpdatePayload(product, existing, config) {
  if (existing.sku !== product.sku) throw new Error('UPDATE: SKU del dettaglio diverso da quello richiesto.');
  const desired = buildBasePayload(product, config);
  const changes = {};
  for (const field of ['ean', 'weight', 'manufacturer_id', 'category_id']) {
    if (desired[field] == null) continue;
    const equal = field === 'ean'
      ? String(desired[field]) === String(existing[field] ?? '')
      : existing[field] != null && Number(desired[field]) === Number(existing[field]);
    if (!equal) changes[field] = desired[field];
  }
  for (const field of ['text_fields', 'prices', 'stock']) {
    const values = {};
    for (const [key, value] of Object.entries(desired[field] ?? {})) {
      const current = existing[field]?.[key];
      const equal = field === 'text_fields'
        ? String(value) === String(current ?? '')
        : current != null && Number(value) === Number(current);
      if (!equal) values[key] = value;
    }
    if (Object.keys(values).length) changes[field] = values;
  }
  if (desired.images) {
    const current = existing.images?.['1'];
    const url = typeof current === 'string' ? current.replace(/^url:/, '') : '';
    const isBaseImage = URL.canParse(url) && new URL(url).hostname === 'upload.cdn.baselinker.com';
    if (!isBaseImage && url !== product.image_link) changes.images = desired.images;
  }
  return Object.keys(changes).length ? { inventory_id: desired.inventory_id, ...changes } : null;
}

export function hasProductChanged(product, existing, config) {
  return buildBaseUpdatePayload(product, existing, config) !== null;
}
