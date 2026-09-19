import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root = process.cwd();
const runtimeFiles = [
  'cli.js',
  'sync.js',
  'index.js',
  'check.js',
  'convert_xml_to_json.js',
  'productor.js',
  'src',
  'package.json',
];

const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <item>
      <title>Prodotto test</title>
      <g:brand>Marca</g:brand>
      <g:id>SKU-TEST</g:id>
      <g:price>25,00 EUR</g:price>
      <g:availability>in stock</g:availability>
    </item>
  </channel>
</rss>`;

const sourceProducts = [
  {
    title: 'Prodotto test',
    brand: 'Marca',
    id: 'SKU-TEST',
    price: '25,00 EUR',
    availability: 'in stock',
  },
];

async function createFixture({ invalidXml = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'vudoo-cli-'));

  try {
    for (const file of runtimeFiles) {
      await cp(join(root, file), join(directory, file), { recursive: true });
    }

    await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction');
    await writeFile(join(directory, 'VUDOO.xml'), invalidXml ? '<rss>' : validXml, 'utf8');
    await writeFile(
      join(directory, 'real_products.json'),
      JSON.stringify(sourceProducts, null, 2),
      'utf8',
    );
    await writeFile(
      join(directory, '.env'),
      'BASE_API_TOKEN=test-only-token\nTEST_MODE=true\nDRY_RUN=true\n',
      'utf8',
    );

    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function withFixture(action, options) {
  const directory = await createFixture(options);

  try {
    return await action(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function controlledEnvironment(extra = {}) {
  const environment = {
    BASE_API_TOKEN: 'test-only-token',
    TEST_MODE: 'true',
    DRY_RUN: 'true',
    NODE_ENV: 'test',
    NODE_NO_WARNINGS: '1',
    NODE_OPTIONS: `--import=${pathToFileURL(join(root, 'tests', 'mock-base.mjs')).href}`,
    ...extra,
  };

  for (const name of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'ComSpec']) {
    if (process.env[name] !== undefined) {
      environment[name] = process.env[name];
    }
  }

  return environment;
}

function runProcess(directory, entry, inputs = [], extraEnv = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], {
      cwd: directory,
      env: controlledEnvironment(extraEnv),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let output = '';
    let timedOut = false;

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('close', (code, signal) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(
          new Error(
            `${entry} non ha completato il workflow entro ${timeoutMs} ms. Output:\n${output}`,
          ),
        );
        return;
      }

      resolve({ code, signal, output });
    });

    child.stdin.end(inputs.map((input) => `${input}\n`).join(''));
  });
}

test('CLI: mostra il menu reale e uscita volontaria termina con codice 0', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'cli.js', ['7']);

    assert.equal(result.code, 0);
    assert.equal(result.signal, null);
    assert.match(result.output, /1\. Converti XML/);
    assert.match(result.output, /5\. Esegui flusso completo/);
    assert.match(result.output, /7\. Esci/);
    assert.doesNotMatch(result.output, /\[CONVERT\] Avvio/);
    assert.doesNotMatch(result.output, /\[PREFLIGHT\] Avvio/);
  });
});

test('CLI: la voce 1 avvia realmente la conversione e poi consente di uscire', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'cli.js', ['1', '7']);

    assert.equal(result.code, 0);
    assert.match(result.output, /\[CONVERT\] Avvio conversione/);
    assert.match(result.output, /XML:\s+1 item/);
    assert.match(result.output, /\[CONVERT\] Conversione completata con successo/);
    assert.doesNotMatch(result.output, /\[PREFLIGHT\] Avvio/);
  });
});

test('CLI: la voce 2 avvia realmente il preflight', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'cli.js', ['2', '7']);

    assert.equal(result.code, 0);
    assert.match(result.output, /\[PREFLIGHT\] Avvio controlli preliminari/);
    assert.match(result.output, /\[PREFLIGHT\] Controlli preliminari completati con successo/);
    assert.doesNotMatch(result.output, /Payload addInventoryProduct/);
  });
});

test('CLI: il sottomenu usa la voce 2 per continuare con l’import', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'cli.js', ['1', '2', '7']);

    assert.equal(result.code, 0);
    assert.match(result.output, /\[CONVERT\] Conversione completata con successo/);
    assert.match(result.output, /2\. Continua con importa \/ aggiorna prodotti/);
    assert.match(result.output, /\[PREFLIGHT\] Controlli preliminari completati con successo/);
    assert.match(result.output, /Payload Base\.com \(addInventoryProduct\)/);
    assert.match(result.output, /DRY_RUN: nessuna scrittura su Base\.com/);
  });
});

test('CLI: input non valido torna al menu senza avviare operazioni', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'cli.js', ['99', '7']);

    assert.equal(result.code, 0);
    assert.match(result.output, /Scelta non valida/);
    assert.doesNotMatch(result.output, /\[(?:CONVERT|PREFLIGHT|IMPORT|SYNC)\] Avvio/);
  });
});

test('CLI: un errore di conversione è attribuito alla fase corretta', async () => {
  await withFixture(
    async (directory) => {
      const result = await runProcess(directory, 'cli.js', ['1', '7']);

      assert.equal(result.code, 1);
      assert.match(result.output, /\[CONVERT\] Avvio conversione/);
      assert.match(result.output, /ERRORE CONVERSIONE/);
      assert.doesNotMatch(result.output, /\[PREFLIGHT\] Avvio/);
      assert.doesNotMatch(result.output, /Payload addInventoryProduct/);
    },
    { invalidXml: true },
  );
});

test('sync diretto: esegue davvero sync.js e completa convert, preflight e import', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'sync.js');

    assert.equal(result.code, 0);
    assert.match(result.output, /--- Step 1: Conversione XML/);
    assert.match(result.output, /--- Step 2: Preflight Check/);
    assert.match(result.output, /\[PREFLIGHT\] Controlli preliminari completati con successo/);
    assert.match(result.output, /--- Step 3: Importazione \/ Aggiornamento prodotti/);
    assert.match(result.output, /Payload Base\.com \(addInventoryProduct\)/);
    assert.match(result.output, /DRY_RUN: nessuna scrittura su Base\.com/);
  });
});

test('sync diretto: preflight fallito blocca l’import nella fase corretta', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'sync.js', [], {
      TEST_BASE_SCENARIO: 'preflight-error',
    });

    assert.equal(result.code, 1);
    assert.match(result.output, /--- Step 2: Preflight Check/);
    assert.match(result.output, /TEST_PREFLIGHT_ERROR/);
    assert.doesNotMatch(result.output, /--- Step 3: Importazione \/ Aggiornamento prodotti/);
    assert.doesNotMatch(result.output, /Payload Base\.com \(addInventoryProduct\)/);
  });
});

test('sync diretto: errore import avviene dopo un preflight riuscito', async () => {
  await withFixture(async (directory) => {
    const result = await runProcess(directory, 'sync.js', [], {
      TEST_BASE_SCENARIO: 'import-error',
    });

    assert.equal(result.code, 1);
    assert.match(result.output, /\[PREFLIGHT\] Controlli preliminari completati con successo/);
    assert.match(result.output, /--- Step 3: Importazione \/ Aggiornamento prodotti/);
    assert.match(result.output, /TEST_IMPORT_ERROR/);
    assert.match(result.output, /\[SYNC\] Importazione fallita con codice: 1/);
  });
});
