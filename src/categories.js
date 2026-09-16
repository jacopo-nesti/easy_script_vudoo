import { callBase } from './baseApi.js';
import { dryRun } from './config.js';
import { log } from './logger.js';

export async function getCategoryMap(inventoryId) {
  const data = await callBase('getInventoryCategories', { inventory_id: inventoryId });
  if (!Array.isArray(data.categories)) throw new Error('getInventoryCategories: elenco non valido.');
  const categories = new Map();
  for (const category of data.categories) {
    const id = Number(category.category_id);
    const parent = Number(category.parent_id ?? 0);
    if (typeof category.name !== 'string' || !category.name.trim() || !Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(parent) || parent < 0) {
      throw new Error('Categoria Base.com non valida.');
    }
    const key = `${parent}:${category.name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
    if (categories.has(key) && categories.get(key) !== id) throw new Error(`Categoria ambigua: ${category.name}.`);
    categories.set(key, id);
  }
  return categories;
}

export async function ensureCategoryPath(productType, inventoryId, categories) {
  if (productType == null || productType === '') return null;
  if (typeof productType !== 'string') throw new Error('product_type deve essere una stringa.');
  if (!productType.trim()) return null;
  const parts = productType.split('>').map(name => name.trim().replace(/\s+/g, ' '));
  if (parts.some(name => !name)) throw new Error('Percorso categorie con livello vuoto.');
  let parent = 0;
  for (const name of parts) {
    const key = `${parent}:${name.toLowerCase()}`;
    if (!categories.has(key)) {
      if (dryRun === 'true') {
        log(`[DRY_RUN] Categoria da creare: ${name} (parent: ${parent})`);
        categories.set(key, null);
      } else {
        const result = await callBase('addInventoryCategory', { inventory_id: inventoryId, name, parent_id: parent });
        const id = Number(result.category_id);
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`ID categoria non valido: ${name}.`);
        categories.set(key, id);
        log(`SUCCESS - Categoria creata: ${name} (${id})`);
      }
    }
    parent = categories.get(key) ?? `simulata:${key}`;
  }
  return typeof parent === 'number' ? parent : null;
}
