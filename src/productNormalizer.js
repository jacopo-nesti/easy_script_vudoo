function parseFeedNumber(value, unit, fieldName) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') throw new Error(`Formato non valido per ${fieldName}`);
  let cleaned = value.replace(unit, '').trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) throw new Error(`Impossibile convertire '${value}' in numero per ${fieldName}`);
  return parsed;
}

export function normalizeProduct(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Il prodotto deve essere un oggetto JSON.');
  }
  const normalized = { ...source };

  if (!source.id || typeof source.id !== 'string' || source.id.trim() === '') {
    throw new Error('Validazione fallita: SKU (id) mancante.');
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

  normalized.sku = source.id.trim();
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

  return normalized;
}