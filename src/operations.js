import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from './logger.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const operations = {
  convert: { label: 'CONVERT', args: ['convert_xml_to_json.js'] },
  productor: { label: 'PRODUCTOR', args: ['productor.js'] },
  import: { label: 'IMPORT', args: ['--env-file=.env', 'index.js'] },
  test: { label: 'TEST', args: ['--experimental-vm-modules', '--test', 'tests/integration-review.test.js', 'tests/cli.test.js'] },
};

export async function runOperation(name) {
  if (name === 'sync') {
    log('[SYNC] Avvio conversione e importazione');
    const conversionCode = await runOperation('convert');
    if (conversionCode !== 0) {
      log('[SYNC] ERRORE: conversione fallita, importazione non avviata');
      return conversionCode;
    }
    const importCode = await runOperation('import');
    log(importCode === 0 ? '[SYNC] Completata' : '[SYNC] ERRORE: importazione fallita');
    return importCode;
  }

  const operation = operations[name];
  if (!operation) throw new Error('Operazione non riconosciuta');
  log(`[${operation.label}] Avvio`);
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, operation.args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('error', error => {
      log(`[${operation.label}] ERRORE avvio: ${error.message}`);
      resolve(1);
    });
    child.once('close', (exitCode, signal) => resolve(exitCode ?? (signal === 'SIGINT' ? 130 : 1)));
  });
  log(code === 0 ? `[${operation.label}] Completata` : `[${operation.label}] ERRORE: codice ${code}`);
  return code;
}
