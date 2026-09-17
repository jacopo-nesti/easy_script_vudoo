import { runEnvironmentCheck } from './src/checker.js';

runEnvironmentCheck()
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    console.error(`\n❌ ERRORE CRITICO DIAGNOSTICA: ${error.message}`);
    process.exitCode = 1;
  });