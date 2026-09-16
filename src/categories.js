import { callBase } from './baseApi.js';
import { log } from './logger.js';

function cleanName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

// --- GESTIONE CATEGORIE ---
export async function getCategoryMap(inventoryId) {
  log('[DEBUG] Caricamento albero categorie esistenti da Base.com...');
  const data = await callBase('getInventoryCategories', { inventory_id: inventoryId });
  const categoryMap = new Map();

  if (data.categories && Array.isArray(data.categories)) {
    for (const cat of data.categories) {
      const cleanCatName = cleanName(cat.name).toLowerCase();
      const parentId = cat.parent_id ?? 0;
      const key = `${parentId}:${cleanCatName}`;
      categoryMap.set(key, cat.category_id);
    }
  }
  
  log(`[DEBUG] Mappate con successo ${categoryMap.size} categorie presenti su Base.com`);
  return categoryMap;
}

export async function ensureCategoryPath(productType, inventoryId, categoryMap) {
  if (!productType || typeof productType !== 'string' || productType.trim() === '') {
    return null;
  }

  const parts = productType
    .split(/>|\/|\||,/)
    .map(p => cleanName(p))
    .filter(p => p.length > 0);

  if (parts.length === 0) return null;

  let currentParentId = 0;
  const pathHierarchy = [];

  for (const categoryName of parts) {
    pathHierarchy.push(categoryName);
    const lookupKey = `${currentParentId}:${categoryName.toLowerCase()}`;

    if (categoryMap.has(lookupKey)) {
      currentParentId = categoryMap.get(lookupKey);
    } else {
      const currentPathString = pathHierarchy.join(' > ');
      log(`[CATEGORIA] Creazione nuovo livello: "${categoryName}" (Percorso: "${currentPathString}", Parent ID: ${currentParentId})`);

      const response = await callBase('addInventoryCategory', {
        inventory_id: inventoryId,
        name: categoryName,
        parent_id: currentParentId,
      });

      if (!response.category_id) {
        throw new Error(`Impossibile creare la categoria "${categoryName}" su Base.com.`);
      }

      const newCategoryId = response.category_id;
      categoryMap.set(lookupKey, newCategoryId);
      
      log(`[SUCCESS] Categoria creata con successo: "${categoryName}" (ID Base: ${newCategoryId})`);
      currentParentId = newCategoryId;
    }
  }

  return currentParentId;
}

// --- GESTIONE PRODUTTORI / MARCHE ---
export async function getManufacturerMap() {
  log('[DEBUG] Caricamento produttori esistenti da Base.com...');
  const data = await callBase('getInventoryManufacturers');
  const manufacturerMap = new Map();

  if (data.manufacturers && Array.isArray(data.manufacturers)) {
    for (const man of data.manufacturers) {
      manufacturerMap.set(cleanName(man.name).toLowerCase(), man.manufacturer_id);
    }
  }

  log(`[DEBUG] Mappati ${manufacturerMap.size} produttori presenti su Base.com`);
  return manufacturerMap;
}

export async function ensureManufacturer(brandName, manufacturerMap) {
  const cleaned = cleanName(brandName);
  if (!cleaned) return null;

  const lookupKey = cleaned.toLowerCase();

  if (manufacturerMap.has(lookupKey)) {
    return manufacturerMap.get(lookupKey);
  }

  log(`[PRODUTTORE] Creazione nuovo produttore: "${cleaned}"...`);
  const response = await callBase('addInventoryManufacturer', {
    name: cleaned
  });

  if (!response.manufacturer_id) {
    throw new Error(`Impossibile creare il produttore "${cleaned}" su Base.com.`);
  }

  const newId = response.manufacturer_id;
  manufacturerMap.set(lookupKey, newId);
  log(`[SUCCESS] Produttore creato con successo: "${cleaned}" (ID: ${newId})`);

  return newId;
}