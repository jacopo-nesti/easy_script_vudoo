const token = process.env.BASE_API_TOKEN?.trim();

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
    throw new Error(`Errore API Base.com (${method}): ${data.error_message ?? 'Risposta non valida'}`);
  }
  return data;
}

export async function getCategories(inventoryId) {
  const data = await callBase('getInventoryCategories', { inventory_id: inventoryId });
  // Normalizza la risposta: gestisce sia Array che Oggetti restituiti da Base.com
  if (!data.categories) return [];
  return Array.isArray(data.categories) ? data.categories : Object.values(data.categories);
}

export async function getOrCreateCategory(productType, existingCategories, inventoryId) {
  if (!productType || typeof productType !== 'string') return null;

  // 1. Spacchetta la gerarchia (es. "Cancelleria > Penne > Sfera" -> ["Cancelleria", "Penne", "Sfera"])
  const parts = productType.split('>').map(p => p.trim()).filter(p => p !== '');
  if (parts.length === 0) return null;

  let currentParentId = 0; // 0 rappresenta il livello radice (nessun genitore)

  for (const part of parts) {
    // 2. Cerca la categoria verificando NOME e PARENT_ID
    let found = existingCategories.find(
      c => c.name.toLowerCase().trim() === part.toLowerCase() &&
           String(c.parent_id ?? 0) === String(currentParentId)
    );

    if (found) {
      currentParentId = found.category_id;
    } else {
      // 3. Se non esiste, crea la categoria su Base.com associandola al padre corrente
      const result = await callBase('addInventoryCategory', {
        inventory_id: inventoryId,
        name: part,
        parent_id: currentParentId
      });

      const newCategoryId = result.category_id;

      // 4. Salva subito la nuova categoria in memoria per evitare duplicati nei prodotti successivi
      existingCategories.push({
        category_id: newCategoryId,
        name: part,
        parent_id: currentParentId
      });

      currentParentId = newCategoryId;
    }
  }

  // Restituisce l'ID della categoria foglia finale
  return currentParentId;
}