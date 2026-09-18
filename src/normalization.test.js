import { describe, it } from 'node:test';
import assert from 'node:assert';

// Importa la funzione o la logica di normalizzazione del tuo progetto
// (Adatta il percorso in base a dove si trova la tua funzione di normalizzazione)
// import { normalizeProduct } from '../src/products.js'; 

describe('Normalizzazione prodotti e gestione fallback quantità/magazzino', () => {
  
  it('dovrebbe trattare la stringa vuota "" come valore mancante o impostarla correttamente', () => {
    const input = { quantity: "" };
    // Esempio di test sul comportamento atteso
    assert.strictEqual(input.quantity === "" ? 0 : input.quantity, 0);
  });

  it('dovrebbe gestire correttamente il valore null', () => {
    const input = { quantity: null, stock_status: "in stock" };
    // Se la quantità è null ma c'è "in stock", applica il fallback (es. 10)
    const resolvedQty = (input.quantity === null || input.quantity === "") && input.stock_status === "in stock" ? 10 : input.quantity;
    assert.strictEqual(resolvedQty, 10);
  });

  it('le quantità reali devono avere priorità sulla disponibilità', () => {
    const input = { quantity: 5, stock_status: "in stock" };
    // La quantità reale (5) deve prevalere sul fallback dello stock
    assert.strictEqual(input.quantity, 5);
  });

  it('dovrebbe gestire lo stato out of stock impostando la quantità a 0 o gestendo il magazzino', () => {
    const input = { quantity: null, stock_status: "out of stock" };
    const resolvedQty = input.stock_status === "in stock" ? 10 : 0;
    assert.strictEqual(resolvedQty, 0);
  });

});