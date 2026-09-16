import { callBase } from './baseApi.js';
import { log } from './logger.js';
import { dryRun } from './config.js';

function cleanName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

export async function getManufacturerMap() {
  log('[DEBUG] Caricamento produttori esistenti da Base.com...');
  const mfgData = await callBase('getInventoryManufacturers');
  const mfgMap = new Map();
  if (!mfgData.manufacturers || typeof mfgData.manufacturers !== 'object') {
    throw new Error('getInventoryManufacturers: elenco non valido.');
  }
  if (mfgData.manufacturers) {
    for (const m of Object.values(mfgData.manufacturers)) {
      const name = m.manufacturer_name ?? m.name;
      const id = Number(m.manufacturer_id);
      if (typeof name !== 'string' || !name.trim() || !Number.isSafeInteger(id) || id <= 0) throw new Error('Produttore Base.com non valido.');
      const key = cleanName(name).toLowerCase();
      if (mfgMap.has(key) && mfgMap.get(key) !== id) throw new Error(`Produttore ambiguo: ${name}.`);
      mfgMap.set(key, id);
    }
  }
  log(`[DEBUG] Mappati ${mfgMap.size} produttori da Base.com`);
  return mfgMap;
}

export function assignManufacturer(product, mfgMap) {
  if (product.brand) {
    const brandKey = cleanName(product.brand).toLowerCase();
    if (mfgMap.has(brandKey)) {
      product.manufacturer_id = mfgMap.get(brandKey);
      log(`[DEBUG] Brand trovato: "${product.brand}" -> manufacturer_id: ${product.manufacturer_id}`);
    } else {
      log(`[WARNING] Brand "${product.brand}" non ancora presente su Base.com`);
    }
  }
}

export async function ensureManufacturer(brandName, manufacturerMap) {
  if (brandName == null || brandName === '') return null;
  if (typeof brandName !== 'string') throw new Error('brand deve essere una stringa.');
  const name = cleanName(brandName);
  if (!name) return null;
  const key = name.toLowerCase();
  if (manufacturerMap.has(key)) return manufacturerMap.get(key);
  if (dryRun === 'true') {
    log(`[DRY_RUN] Produttore da creare: ${name}`);
    manufacturerMap.set(key, null);
    return null;
  }
  const result = await callBase('addInventoryManufacturer', { manufacturer_name: name });
  const id = Number(result.manufacturer_id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`ID produttore non valido: ${name}.`);
  manufacturerMap.set(key, id);
  log(`SUCCESS - Produttore creato: ${name} (${id})`);
  return id;
}
