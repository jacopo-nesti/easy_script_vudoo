// test.js
import { getProducts, normalizeProduct, buildBasePayload } from './src/products.js';

try {
  const products = await getProducts();
  console.log(`Caricati ${products.length} prodotti da real_products.json.`);

  // Prova a normalizzare il primo prodotto
  const sampleProduct = normalizeProduct(products[0]);
  console.log('Primo prodotto normalizzato con successo:', sampleProduct.id);

} catch (error) {
  console.error('Errore durante la validazione:', error.message);
}