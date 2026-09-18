import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from './logger.js';
import { runPreflightCheck } from './preflight.js';
import { convertXmlToJson } from './converter.js';
import { runEnvironmentCheck } from './checker.js';

function executeScript(scriptPath) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--env-file=.env', scriptPath], {
      stdio: 'inherit',
      env: process.env,
    });
    child.once('error', error => {
      log(`[OPERATIONS] Impossibile avviare ${scriptPath}: ${error.message}`);
      resolve(1);
    });
    child.once('close', code => {
      const exitCode = code !== 0 ? (code ?? 1) : 0;
      resolve(exitCode);
    });
  });
}

export async function runOperation(name) {
  if (name === 'check') {
    try {
      return await runEnvironmentCheck();
    } catch (error) {
      log(`\n❌ ERRORE DIAGNOSTICA: ${error.message}`);
      return 1;
    }
  }

  if (name === 'convert') {
    try {
      log('\n[CONVERT] Avvio conversione XML → JSON...');
      await convertXmlToJson();
      log('[CONVERT] Conversione completata con successo! ✅');
      return 0;
    } catch (error) {
      log(`\n❌ ERRORE CONVERSIONE: ${error.message}`);
      return 1;
    }
  }

  if (name === 'preflight') {
    try {
      await runPreflightCheck();
      return 0;
    } catch (error) {
      log(`\n❌ ERRORE PREFLIGHT: ${error.message}`);
      return 1;
    }
  }

  if (name === 'sync') {
    log('\n=== ESECUZIONE FLUSSO COMPLETO ===\n');

    log('--- Step 1: Conversione XML → JSON ---');
    try {
      await convertXmlToJson();
      log('[CONVERT] Conversione completata con successo! ✅');
    } catch (error) {
      log(`[SYNC] Conversione XML fallita: ${error.message}`);
      return 1;
    }

    log('\n--- Step 2: Preflight Check ---');
    try {
      await runPreflightCheck();
    } catch (error) {
      log(`\n❌ ERRORE PREFLIGHT: ${error.message}`);
      return 1;
    }

    log('\n--- Step 3: Importazione / Aggiornamento prodotti ---');
    const importCode = await executeScript(fileURLToPath(new URL('../index.js', import.meta.url)));
    if (importCode !== 0) {
      log(`[SYNC] Importazione fallita con codice: ${importCode}`);
      return importCode;
    }
    return 0;
  }

  if (name === 'test') {
    const test1 = fileURLToPath(new URL('../tests/integration-review.test.js', import.meta.url));
    const test2 = fileURLToPath(new URL('../tests/cli.test.js', import.meta.url));

    return await new Promise(resolve => {
      const child = spawn(process.execPath, ['--experimental-vm-modules', '--test', test1, test2], {
        stdio: 'inherit',
        env: process.env,
        windowsHide: true
      });
      child.once('error', error => {
        log(`[TEST] Impossibile avviare i test: ${error.message}`);
        resolve(1);
      });
      child.once('close', code => resolve(code ?? 1));
    });
  }

  const scripts = {
    productor: '../productor.js',
    import: '../index.js'
  };

  const relativePath = scripts[name];
  if (!relativePath) throw new Error(`Operazione non valida: ${name}`);
  return await executeScript(fileURLToPath(new URL(relativePath, import.meta.url)));
}