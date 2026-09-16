import { callBase } from './baseApi.js';
import { log } from './logger.js';

export async function getManufacturerMap() {
  log('[DEBUG] Caricamento produttori esistenti da Base.com...');
  const mfgData = await callBase('getInventoryManufacturers');
  const mfgMap = new Map();
  if (mfgData.manufacturers) {
    for (const m of Object.values(mfgData.manufacturers)) {
      if (m.name && m.manufacturer_id) {
        mfgMap.set(m.name.trim().toLowerCase(), m.manufacturer_id);
      }
    }
  }
  log(`[DEBUG] Mappati ${mfgMap.size} produttori da Base.com`);
  return mfgMap;
}

export function assignManufacturer(product, mfgMap) {
  if (product.brand) {
    const brandKey = product.brand.trim().toLowerCase();
    if (mfgMap.has(brandKey)) {
      product.manufacturer_id = mfgMap.get(brandKey);
      log(`[DEBUG] Brand trovato: "${product.brand}" -> manufacturer_id: ${product.manufacturer_id}`);
    } else {
      log(`[WARNING] Brand "${product.brand}" non ancora presente su Base.com`);
    }
  }
}
