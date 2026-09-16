import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as xml from 'fast-xml-parser';
import { parseFeedNumber, normalizeProduct, buildBasePayload, buildBaseUpdatePayload, detectAndFilterDuplicates } from '../src/products.js';

const source = { id: 'SKU-A', title: 'Prodotto', price: '25,00 EUR', weight: '0.1 Kg', brand: 'Marca', product_type: 'Casa > Cura' };
const config = { inventory: { inventory_id: 10 }, priceGroup: { price_group_id: 20, currency: 'EUR' }, warehouse: { id: 'bl_30' } };
const details = { sku: 'SKU-A', weight: 0.1, text_fields: { name: 'Prodotto' }, prices: { 99: 100, 20: 25 }, manufacturer_id: 40, category_id: 51, images: {} };

async function sandbox(options = {}) {
  const calls = [], logs = [], writes = new Map();
  const processMock = { env: { BASE_API_TOKEN: 'test-only-token', TEST_MODE: 'true', DRY_RUN: 'true', ...options.env }, exitCode: 0 };
  const context = vm.createContext({
    URL, URLSearchParams, AbortSignal, process: processMock,
    console: { log: (...args) => logs.push(args.join(' ')), warn: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) },
    fetch: async (url, request) => {
      assert.equal(url, 'https://api.baselinker.com/connector.php');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers['X-BLToken'], 'test-only-token');
      assert.ok(request.signal);
      const method = request.body.get('method');
      const parameters = JSON.parse(request.body.get('parameters'));
      calls.push({ method, parameters });
      if (options.httpError) return { ok: false, status: 503 };
      if (options.networkError) throw new Error('Rete simulata non disponibile');
      const responses = {
        getInventories: { inventories: options.inventories ?? [{ inventory_id: 11, is_default: false }, { inventory_id: 10, name: 'Default', is_default: true, price_groups: [20], default_price_group: 20, warehouses: ['bl_30'] }] },
        getInventoryPriceGroups: { price_groups: [{ price_group_id: 20, currency: 'EUR', name: 'Default' }] },
        getInventoryWarehouses: { warehouses: options.warehouses ?? [{ warehouse_id: 30, warehouse_type: 'bl', name: 'Warehouse' }] },
        getInventoryManufacturers: { manufacturers: options.manufacturers ?? [{ manufacturer_id: 40, name: 'Marca' }] },
        getInventoryCategories: { categories: options.categories ?? [{ category_id: 50, parent_id: 0, name: 'Casa' }, { category_id: 51, parent_id: 50, name: 'Cura' }] },
        getInventoryProductsList: options.lookupError ? { status: 'ERROR', error_code: 'LOOKUP_FAILED', error_message: 'Errore simulato' } : { products: options.matches ?? (options.existing ? { 60: { id: 60, sku: parameters.filter_sku } } : {}) },
        getInventoryProductsData: { products: { 60: options.details ?? details } },
        addInventoryProduct: { product_id: parameters.product_id ?? 60 },
        addInventoryCategory: { category_id: 100 + calls.length },
        addInventoryManufacturer: { manufacturer_id: 200 + calls.length }
      };
      assert.ok(responses[method], 'Metodo inatteso: ' + method);
      return { ok: true, json: async () => ({ status: 'SUCCESS', ...responses[method] }) };
    }
  });
  const fakeFs = {
    readFile: async url => {
      const filename = fileURLToPath(url);
      if (writes.has(filename)) return writes.get(filename);
      if (filename.endsWith('real_products.json')) return JSON.stringify(options.products ?? [source]);
      if (filename.endsWith('VUDOO.xml')) return '<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><title>Test</title><g:id>SKU-A</g:id><g:brand>Marca</g:brand><g:price>25,00 EUR</g:price></item></channel></rss>';
      return fs.readFileSync(filename, 'utf8');
    },
    writeFile: async (url, text) => writes.set(fileURLToPath(url), text)
  };
  const modules = new Map();
  function load(id) {
    if (modules.has(id)) return modules.get(id);
    const exports = id === 'node:fs/promises' ? fakeFs : id === 'fast-xml-parser' ? xml : null;
    const module = exports ? new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context, identifier: id }) : new vm.SourceTextModule(fs.readFileSync(fileURLToPath(id), 'utf8'), {
      context, identifier: id, initializeImportMeta: meta => { meta.url = id; }
    });
    modules.set(id, module);
    return module;
  }
  const module = load(new URL(options.entry ?? '../index.js', import.meta.url).href);
  await module.link((specifier, parent) => load(specifier.startsWith('.') ? new URL(specifier, parent.identifier).href : specifier));
  await module.evaluate();
  if (options.action) await options.action(module.namespace);
  for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve));
  return { calls, logs, writes, exitCode: processMock.exitCode };
}

for (const [value, unit, expected] of [['25,00 EUR', 'EUR', 25], ['999,00 EUR', 'EUR', 999], ['1.098,00 EUR', 'EUR', 1098], ['4.880,00 EUR', 'EUR', 4880], ['0.1 Kg', 'Kg', 0.1], ['1.234.567,89 EUR', 'EUR', 1234567.89]]) {
  test('Parsing ' + value, () => assert.equal(parseFeedNumber(value, unit, 'campo'), expected));
}
test('Parsing rifiuta raggruppamenti malformati', () => {
  for (const value of ['1.09,00 EUR', '1 2 EUR', '1,2,3 EUR', '-2 EUR']) assert.throws(() => parseFeedNumber(value, 'EUR', 'price'));
});
test('Duplicati equivalenti senza nascondere prodotti invalidi', () => {
  const result = detectAndFilterDuplicates([source, { ...source, link: 'altro link' }, null, { title: 'Senza SKU' }]);
  assert.equal(result.uniqueProducts.length, 3);
  assert.equal(result.duplicatesMap.get(source.id), 2);
  assert.throws(() => detectAndFilterDuplicates([source, { ...source, price: '30,00 EUR' }]), /discordanti/);
});
test('Payload: warehouse reale, ID stretti, nessuno stock inventato', () => {
  const normalized = normalizeProduct(source);
  assert.equal(buildBasePayload(normalized, config).stock, undefined);
  assert.deepEqual(buildBasePayload({ ...normalized, quantity: 2 }, config).stock, { bl_30: 2 });
  assert.throws(() => buildBasePayload({ ...normalized, quantity: 2 }, { ...config, warehouse: { id: 'default' } }));
  assert.throws(() => buildBasePayload({ ...normalized, category_id: '12abc' }, config));
});
test('UPDATE confronta il gruppo selezionato e invia solo le differenze', () => {
  const normalized = normalizeProduct(source);
  assert.equal(buildBaseUpdatePayload(normalized, details, config), null);
  assert.deepEqual(buildBaseUpdatePayload({ ...normalized, price: 26 }, details, config), { inventory_id: 10, prices: { 20: 26 } });
  assert.deepEqual(buildBaseUpdatePayload(normalized, { ...details, prices: {} }, config), { inventory_id: 10, prices: { 20: 25 } });
  assert.throws(() => buildBaseUpdatePayload(normalized, { ...details, sku: 'ALTRO' }, config));
});
test('UPDATE omette dati sorgente assenti e conserva immagini CDN non confrontabili', () => {
  const normalized = normalizeProduct({ ...source, image_link: 'https://example.org/image.jpg' });
  assert.equal(buildBaseUpdatePayload(normalized, { ...details, ean: '12345678', images: { 1: 'https://upload.cdn.baselinker.com/image.jpg' } }, config), null);
  assert.equal(buildBaseUpdatePayload(normalized, { ...details, images: { 1: normalized.image_link } }, config), null);
  assert.ok(buildBaseUpdatePayload(normalized, { ...details, images: {} }, config).images);
});
test('Nuovo prodotto: TEST_MODE limita a uno e DRY_RUN non scrive', async () => {
  const result = await sandbox({ products: [source, { ...source, id: 'SKU-B' }] });
  assert.equal(result.exitCode, 0);
  assert.equal(result.calls.filter(call => call.method === 'getInventoryProductsList').length, 1);
  assert.ok(result.logs.some(log => log.includes('Simulati: 1')));
  assert.ok(result.calls.every(call => call.method.startsWith('get')));
});
test('Prodotto invariato: SKIPPED', async () => {
  const result = await sandbox({ existing: true });
  assert.ok(result.logs.some(log => log.includes('Saltati perché invariati: 1')));
  assert.ok(result.calls.every(call => call.method.startsWith('get')));
});
test('UPDATE in DRY_RUN resta simulato', async () => {
  const result = await sandbox({ existing: true, details: { ...details, prices: { 20: 24 } } });
  assert.ok(result.logs.some(log => log.includes('Payload Base.com (UPDATE)')));
  assert.ok(result.calls.every(call => call.method.startsWith('get')));
});
test('Categorie e produttori assenti: simulazione senza ID inventati', async () => {
  const result = await sandbox({ categories: [], manufacturers: [] });
  assert.equal(result.exitCode, 0);
  assert.ok(result.logs.some(log => log.includes('Categoria da creare')));
  assert.ok(result.logs.some(log => log.includes('Produttore da creare')));
  assert.ok(result.calls.every(call => call.method.startsWith('get')));
});
test('Associazioni mancanti su prodotto invariato: simulato, non SKIPPED', async () => {
  const result = await sandbox({ existing: true, categories: [], manufacturers: [] });
  assert.ok(result.logs.some(log => log.includes('Simulati: 1')));
});
test('Errore lookup: nessuna creazione, errore conteggiato', async () => {
  const result = await sandbox({ lookupError: true });
  assert.equal(result.exitCode, 1);
  assert.ok(result.logs.some(log => log.includes('LOOKUP_FAILED')));
  assert.ok(result.calls.every(call => call.method.startsWith('get')));
});
test('SKU ambiguo su Base: blocco del prodotto', async () => {
  const result = await sandbox({ matches: { 60: { sku: source.id }, 61: { sku: source.id } } });
  assert.equal(result.exitCode, 1);
  assert.ok(result.logs.some(log => log.includes('ambiguo')));
});
test('Nessun fallback da EAN a SKU', async () => {
  const result = await sandbox({ matches: { 60: { ean: source.id } } });
  assert.equal(result.exitCode, 1);
});
test('HTTP e rete: uscita fallita', async () => {
  for (const options of [{ httpError: true }, { networkError: true }]) {
    const result = await sandbox(options);
    assert.equal(result.exitCode, 1);
  }
});
test('Inventory esplicito errato non seleziona il primo', async () => {
  assert.equal((await sandbox({ env: { BASE_INVENTORY_ID: '999' } })).exitCode, 1);
});
test('Default ambiguo: nessuna scelta arbitraria', async () => {
  assert.equal((await sandbox({ inventories: [{ is_default: true }, { is_default: true }] })).exitCode, 1);
});
test('Quantita: recupero del warehouse associato', async () => {
  const result = await sandbox({ products: [{ ...source, quantity: 2 }], env: { BASE_WAREHOUSE_ID: 'bl_30' } });
  assert.equal(result.exitCode, 0);
  assert.ok(result.logs.some(log => log.includes('"bl_30": 2')));
});
test('Tutti i prodotti: dedup e prosecuzione dopo errore', async () => {
  const result = await sandbox({ env: { TEST_MODE: 'false' }, products: [source, source, { ...source, id: 'INVALID', price: 'bad' }, { ...source, id: 'SKU-B' }] });
  assert.equal(result.exitCode, 1);
  assert.ok(result.logs.some(log => log.includes('Simulati: 2')));
  assert.ok(result.logs.some(log => log.includes('Duplicati nel feed saltati: 1')));
  assert.ok(result.logs.some(log => log.includes('SKU con errori: INVALID')));
});
test('Creazioni simulate via mock: gerarchia e mappe riutilizzate', async () => {
  const result = await sandbox({ env: { DRY_RUN: 'false', TEST_MODE: 'false' }, categories: [], manufacturers: [], products: [source, { ...source, id: 'SKU-B', brand: ' MARCA ' }] });
  assert.equal(result.exitCode, 0);
  const categories = result.calls.filter(call => call.method === 'addInventoryCategory');
  assert.equal(categories.length, 2);
  assert.equal(categories[0].parameters.parent_id, 0);
  assert.ok(categories[1].parameters.parent_id > 0);
  assert.equal(result.calls.filter(call => call.method === 'addInventoryManufacturer').length, 1);
  assert.ok(result.logs.some(log => log.includes('Creati: 2')));
});
test('UPDATE mock: ID corretto, nessuna riscrittura dei campi invariati', async () => {
  const result = await sandbox({ env: { DRY_RUN: 'false' }, existing: true, details: { ...details, prices: { 20: 24 } } });
  const update = result.calls.find(call => call.method === 'addInventoryProduct');
  assert.deepEqual(update.parameters, { inventory_id: 10, prices: { 20: 25 }, product_id: 60 });
  assert.ok(result.logs.some(log => log.includes('Aggiornati: 1')));
});
test('Gate API blocca scritture dirette in DRY_RUN', async () => {
  await sandbox({ entry: '../src/baseApi.js', action: async api => {
    await assert.rejects(api.callBase('addInventoryProduct', {}), /bloccata/);
  } });
});
test('Categorie omonime con stesso parent: errore senza creazioni', async () => {
  const result = await sandbox({ categories: [{ category_id: 50, name: 'Casa', parent_id: 0 }, { category_id: 51, name: ' CASA ', parent_id: 0 }] });
  assert.equal(result.exitCode, 1);
  assert.ok(result.calls.every(call => call.method.startsWith('get')));
});
test('Produttori omonimi: errore senza scelta arbitraria', async () => {
  const result = await sandbox({ manufacturers: [{ manufacturer_id: 40, name: 'Marca' }, { manufacturer_id: 41, name: ' MARCA ' }] });
  assert.equal(result.exitCode, 1);
});
test('Punteggiatura categorie conservata; solo maggiore separa la gerarchia', async () => {
  const result = await sandbox({ env: { DRY_RUN: 'false' }, categories: [], products: [{ ...source, product_type: 'Casa, bagno/cucina | accessori > Cura' }] });
  const created = result.calls.filter(call => call.method === 'addInventoryCategory');
  assert.equal(created.length, 2);
  assert.equal(created[0].parameters.name, 'Casa, bagno/cucina | accessori');
});
test('Warehouse ambiguo blocca lo stock; ID esplicito risolve', async () => {
  const warehouses = [{ warehouse_id: 30, warehouse_type: 'bl' }, { warehouse_id: 31, warehouse_type: 'bl' }];
  const inventories = [{ inventory_id: 10, is_default: true, price_groups: [20], default_price_group: 20, warehouses: ['bl_30', 'bl_31'] }];
  const options = { warehouses, inventories, products: [{ ...source, quantity: 2 }] };
  assert.equal((await sandbox(options)).exitCode, 1);
  assert.equal((await sandbox({ ...options, env: { BASE_WAREHOUSE_ID: 'bl_31' } })).exitCode, 0);
});
test('Flag non valido: nessuna richiesta API', async () => {
  const result = await sandbox({ env: { DRY_RUN: 'TRUE' } });
  assert.equal(result.exitCode, 1);
  assert.equal(result.calls.length, 0);
});
test('Produttori: riuso cache e DRY_RUN anche nel comando separato', async () => {
  const result = await sandbox({ entry: '../src/productor.js', manufacturers: [], products: [{ brand: 'Marca' }, { brand: ' MARCA ' }], action: module => module.syncManufacturers() });
  assert.equal(result.logs.filter(log => log.includes('Produttore da creare')).length, 1);
  assert.ok(result.calls.every(call => call.method.startsWith('get')));
});
test('Convertitore eseguito in memoria senza sovrascrivere il JSON locale', async () => {
  const result = await sandbox({ entry: '../src/converter.js', action: module => module.convertXmlToJson() });
  assert.equal(result.writes.size, 1);
  const products = JSON.parse([...result.writes.values()][0]);
  assert.equal(products.length, 1);
  assert.equal(products[0].mpn, products[0].id);
  assert.equal(products[0].tax_rate, '22');
  assert.equal(result.calls.length, 0);
});
