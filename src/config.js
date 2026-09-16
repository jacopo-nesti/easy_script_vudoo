export const token = process.env.BASE_API_TOKEN?.trim();
export const inventoryId = process.env.BASE_INVENTORY_ID?.trim();
export const warehouseId = process.env.BASE_WAREHOUSE_ID?.trim();
export const testMode = process.env.TEST_MODE ?? 'true';
export const dryRun = process.env.DRY_RUN ?? 'true';
