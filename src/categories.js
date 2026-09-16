import { callBase } from './baseApi.js';
import { log } from './logger.js';

/**
 * Normalizza il testo per garantire confronti coerenti
 */
function cleanCategoryName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Carica tutte le categorie esistenti su Base.com e costruisce una mappa in memoria
 */
export async function getCategoryMap(inventoryId) {
  log('[DEBUG] Caricamento albero categorie esistenti da Base.com...');
  const data = await callBase('getInventoryCategories', { inventory_id: inventoryId });
  const categoryMap = new Map();

  if (data.categories && Array.isArray(data.categories)) {
    for (const cat of data.categories) {
      const cleanName = cleanCategoryName(cat.name).toLowerCase();
      const parentId = cat.parent_id ?? 0;
      
      // Chiave univoca basata sul Padre e sul Nome della Categoria
      const key = `${parentId}:${cleanName}`;
      categoryMap.set(key, cat.category_id);
    }
  }
  
  log(`[DEBUG] Mappate con successo ${categoryMap.size} categorie presenti su Base.com`);
  return categoryMap;
}

/**
 * Analizza il tipo di prodotto e assicura l'intera gerarchia padre/figlio.
 * Supporta separatori multipli: '>', '/', '|', ','
 */
export async function ensureCategoryPath(productType, inventoryId, categoryMap) {
  if (!productType || typeof productType !== 'string' || productType.trim() === '') {
    return null;
  }

  // Splitting avanzato per gestire tutti i principali tipi di separatori nei feed XML/JSON
  const parts = productType
    .split(/>|\/|\||,/)
    .map(p => cleanCategoryName(p))
    .filter(p => p.length > 0);

  if (parts.length === 0) return null;

  let currentParentId = 0;
  const pathHierarchy = [];

  for (const categoryName of parts) {
    pathHierarchy.push(categoryName);
    const lookupKey = `${currentParentId}:${categoryName.toLowerCase()}`;

    // 1. Categoria già mappata/esistente
    if (categoryMap.has(lookupKey)) {
      currentParentId = categoryMap.get(lookupKey);
    } else {
      // 2. Categoria mancante: Creazione a cascata
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

  // Ritorna l'ID della categoria foglia (l'ultima della gerarchia)
  return currentParentId;
}