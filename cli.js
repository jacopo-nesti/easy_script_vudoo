import { createInterface } from 'node:readline';
import { dryRun, testMode } from './src/config.js';
import { log } from './src/logger.js';
import { runOperation } from './src/operations.js';

const input = createInterface({ input: process.stdin, output: process.stdout });
const answers = input[Symbol.asyncIterator]();
input.on('SIGINT', () => {
  process.exitCode = 130;
  input.close();
});

async function ask(prompt) {
  process.stdout.write(prompt);
  const answer = await answers.next();
  return answer.done ? null : answer.value.trim();
}

function mode(value) {
  if (value === 'true') return 'ATTIVO';
  if (value === 'false') return 'DISATTIVO';
  return 'NON VALIDO (attesi true oppure false)';
}

async function main() {
  const choices = { 1: 'convert', 2: 'productor', 3: 'import', 4: 'sync', 5: 'test' };
  while (true) {
    log(`\n================================\nVUDOO → BASE.COM\n================================\nDRY_RUN: ${mode(dryRun)}\nTEST_MODE: ${mode(testMode)}\n\n1. Converti XML → JSON\n2. Sincronizza produttori\n3. Importa / aggiorna prodotti su Base.com\n4. Esegui flusso completo\n5. Esegui test automatici\n6. Esci`);
    const choice = await ask('Seleziona operazione: ');
    if (choice === null || choice === '6') return;
    let operation = Object.hasOwn(choices, choice) ? choices[choice] : null;
    if (!operation) {
      log('Scelta non valida. Seleziona un numero da 1 a 6.');
      continue;
    }

    while (operation) {
      const code = await runOperation(operation);
      process.exitCode = code;
      const next = code === 0 && ['convert', 'productor'].includes(operation) ? 'import' : null;
      while (true) {
        log(`\n1. Torna al menu principale${next ? '\n2. Continua con importa / aggiorna prodotti' : ''}\n6. Esci`);
        const action = await ask('Prossima azione: ');
        if (action === null || action === '6') return;
        if (action === '1') {
          operation = null;
          break;
        }
        if (action === '2' && next) {
          operation = next;
          break;
        }
        log('Scelta non valida.');
      }
    }
  }
}

main().catch(error => {
  log(`[CLI] ERRORE: ${error.message}`);
  process.exitCode = 1;
}).finally(() => input.close());
