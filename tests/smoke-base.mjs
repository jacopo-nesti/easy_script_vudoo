import './read-only-base.mjs';
import { getBaseInventory, getBasePriceGroup } from '../src/baseApi.js';

async function main() {
  console.log('[SMOKE TEST] Avvio smoke test read-only su Base.com...');

  const inventory = await getBaseInventory();
  console.log(`[SMOKE TEST] Inventory: ${inventory.name} (${inventory.inventory_id})`);

  const priceGroup = await getBasePriceGroup(inventory);
  console.log(`[SMOKE TEST] Gruppo prezzi: ${priceGroup.name} (${priceGroup.price_group_id}, ${priceGroup.currency})`);

  console.log('[SMOKE TEST] SUCCESS - connessione, inventory, gruppo prezzi e protezioni read-only verificati.');
}

main().catch(error => {
  console.error(`[SMOKE TEST] ERROR: ${error.message}`);
  process.exitCode = 1;
});
