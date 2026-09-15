import { readFile } from 'node:fs/promises';

// Carica automaticamente le variabili dal file .env
try {
  const envContent = await readFile(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim();
    }
  }
} catch {
  // Ignora se il file .env non viene trovato
}

const token = process.env.BASE_API_TOKEN?.trim();
const dryRun = process.env.DRY_RUN ?? 'false';

async function callBase(method, parameters = {}) {
  const response = await fetch('https://api.baselinker.com/connector.php', {
    method: 'POST',
    headers: { 'X-BLToken': token },
    body: new URLSearchParams({ method, parameters: JSON.stringify(parameters) }),
  });

  if (!response.ok) {
    throw new Error(`${method}: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'SUCCESS') {
    throw new Error(`${method}: ${data.error_message ?? 'Errore API Base.com'}`);
  }
  return data;
}

export async function syncManufacturers() {
  if (!token) throw new Error('BASE_API_TOKEN mancante nel file .env');

  // 1. Recupera i produttori già presenti su Base.com
  console.log('Lettura produttori esistenti su Base.com...');
  const baseData = await callBase('getInventoryManufacturers');
  const existingMap = new Map();
  if (baseData.manufacturers) {
    for (const m of Object.values(baseData.manufacturers)) {
      if (m.name) existingMap.set(m.name.trim().toLowerCase(), m.manufacturer_id);
    }
  }

  // 2. Legge i prodotti dal JSON per estrarre i brand
  const productsRaw = await readFile(new URL('../real_products.json', import.meta.url), 'utf8');
  const products = JSON.parse(productsRaw.replace(/^\uFEFF/, ''));

  const uniqueBrands = new Set(
    products
      .map(p => p.brand)
      .filter(b => typeof b === 'string' && b.trim() !== '')
  );

  console.log(`Brand trovati nel JSON: ${uniqueBrands.size}`);

  // 3. Per ciascun brand, se non esiste su Base.com, invia il nome
  for (const brand of uniqueBrands) {
    const cleanName = brand.trim();
    const lookupKey = cleanName.toLowerCase();

    if (existingMap.has(lookupKey)) {
      console.log(`[SKIP] Già presente: "${cleanName}" (ID: ${existingMap.get(lookupKey)})`);
      continue;
    }

    if (dryRun === 'true') {
      console.log(`[DRY_RUN] Creazione simulata del produttore: "${cleanName}"`);
      continue;
    }

    console.log(`[CREAZIONE] Creo produttore: "${cleanName}"...`);
    const res = await callBase('addInventoryManufacturer', { name: cleanName });
    console.log(`[SUCCESS] Creato "${cleanName}" -> manufacturer_id: ${res.manufacturer_id}`);
  }
}
