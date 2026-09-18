import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeProduct, buildBasePayload } from './products.js';

const baseMockProduct = {
  id: 'SKU123',
  title: 'Prodotto Test',
  price: '10,00 EUR'
};

const mockConfig = {
  inventory: { inventory_id: '123' },
  priceGroup: { price_group_id: '1', currency: 'EUR' },
  warehouse: { id: 'bl_1' }
};

test('normalizzazione quantità: valore 0', () => {
  const norm = normalizeProduct({ ...baseMockProduct, quantity: 0 });
  assert.strictEqual(norm.quantity, 0);
});

test('normalizzazione quantità: valore 200 (nessun limite massimo)', () => {
  const norm = normalizeProduct({ ...baseMockProduct, quantity: 200 });
  assert.strictEqual(norm.quantity, 200);
});

test('normalizzazione quantità: stringa vuota "" trattata come valore mancante', () => {
  const norm = normalizeProduct({ ...baseMockProduct, quantity: '' });
  assert.strictEqual(norm.quantity, undefined);
});

test('normalizzazione quantità: valore null trattato come valore mancante', () => {
  const norm = normalizeProduct({ ...baseMockProduct, quantity: null });
  assert.strictEqual(norm.quantity, undefined);
});

test('normalizzazione disponibilità: "in stock" imposta quantity a 10', () => {
  const norm = normalizeProduct({ ...baseMockProduct, availability: 'in stock' });
  assert.strictEqual(norm.quantity, 10);
});

test('normalizzazione disponibilità: "esaurito" / "out of stock" imposta quantity a 0', () => {
  const norm = normalizeProduct({ ...baseMockProduct, availability: 'out of stock' });
  assert.strictEqual(norm.quantity, 0);
});

test('priorità: quantità reale ha precedenza su availability', () => {
  const norm = normalizeProduct({ ...baseMockProduct, quantity: 50, availability: 'out of stock' });
  assert.strictEqual(norm.quantity, 50);
});

test('fallback + warehouse: quantità derivata da availability richiede magazzino valido', () => {
  const product = normalizeProduct({ ...baseMockProduct, availability: 'in stock' });
  const payload = buildBasePayload(product, mockConfig);
  assert.deepStrictEqual(payload.stock, { 'bl_1': 10 });
});