import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
  const { syncManufacturers } = await import('./src/productor.js');
  await syncManufacturers();
} catch (error) {
  const { log } = await import('./src/logger.js');
  log(`Errore: ${error.message}`);
  process.exitCode = 1;
}
