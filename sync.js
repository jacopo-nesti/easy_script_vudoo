import { runOperation } from './src/operations.js';
import { log } from './src/logger.js';

try {
  process.exitCode = await runOperation('sync');
} catch (error) {
  log(`[SYNC] ERRORE: ${error.message}`);
  process.exitCode = 1;
}
