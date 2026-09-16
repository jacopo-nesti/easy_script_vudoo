import { readFile, writeFile } from 'node:fs/promises';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const fields = [
  'title', 'brand', 'condition', 'description', 'id', 'image_link', 'link',
  'ean', 'mpn', 'price', 'sale_price', 'product_type', 'weight',
  'shipping_weight', 'availability', 'pickup_SLA', 'tax_rate', 'shipping',
];
const shippingFields = ['country', 'service', 'price'];

export function completeFields(object, expected, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    throw new Error(`${label}: struttura XML inattesa, conversione interrotta.`);
  }
  for (const field of Object.keys(object)) {
    if (!expected.includes(field)) {
      console.warn(`WARNING ${label}: campo non previsto "${field}", conservato nel JSON.`);
    }
  }
  for (const field of expected) {
    if (object[field] === undefined) object[field] = null;
  }
}

export async function convertXmlToJson() {
  const xml = await readFile(new URL('../Fisio-Cosmetics-product-feed (3).xml', import.meta.url), 'utf8');
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(`XML non valido: ${validation.err.msg} (riga ${validation.err.line})`);
  }

  const parser = new XMLParser({
    parseTagValue: false,
    trimValues: false,
    ignoreAttributes: false,
    transformTagName: name => name.startsWith('g:') ? name.slice(2) : name,
    isArray: (name, path) => path === 'rss.channel.item',
    // Ignora solo l'indentazione tra elementi, mai gli spazi nei valori dei campi.
    tagValueProcessor: (name, value, path, attributes, isLeaf) =>
      !isLeaf && value.trim() === '' ? '' : value,
  });
  const products = parser.parse(xml).rss?.channel?.item;
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Nessun item trovato nel percorso rss.channel.item.');
  }
  const itemCount = products.length;
  for (const product of products) {
    completeFields(product, fields, `item ${product.id ?? '(id assente)'}`);
    product.tax_rate = '22';
    product.mpn = product.id;
    if (typeof product.title === 'string' && typeof product.brand === 'string' && product.brand.trim() !== '') {
      const suffix = ` - ${product.brand}`;
      if (!product.title.endsWith(suffix)) product.title += suffix;
    }
    if (product.shipping !== null) {
      completeFields(product.shipping, shippingFields, `shipping di ${product.id}`);
    }
  }

  const output = new URL('../real_products.json', import.meta.url);
  await writeFile(output, JSON.stringify(products, null, 2) + '\n', 'utf8');
  const saved = JSON.parse(await readFile(output, 'utf8'));
  if (saved.length !== itemCount) throw new Error('Numero prodotti JSON diverso dagli item XML.');
  console.log(`XML: ${itemCount} item\nJSON: ${saved.length} prodotti\nFile creato: real_products.json`);
  console.log(`EAN mancanti (null): ${saved.filter(product => product.ean === null).length}`);
}
