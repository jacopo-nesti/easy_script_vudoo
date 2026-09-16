import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'vudoo-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'src'));
  await mkdir(join(directory, 'tests'));
  for (const file of ['cli.js', 'sync.js', 'src/operations.js', 'src/config.js', 'src/logger.js']) {
    await copyFile(new URL(`../${file}`, import.meta.url), join(directory, file));
  }
  await writeFile(join(directory, 'package.json'), '{"type":"module"}');
  await writeFile(join(directory, '.env'), 'DRY_RUN=true\nTEST_MODE=true\n');
  for (const [file, operation] of [['convert_xml_to_json.js', 'convert'], ['productor.js', 'productor'], ['index.js', 'import'], ['tests/integration-review.test.js', 'test']]) {
    await writeFile(join(directory, file), `
      import { appendFileSync } from 'node:fs';
      appendFileSync('trace.txt', '${operation} ' + process.env.DRY_RUN + ' ' + process.env.TEST_MODE + '\\n');
      process.exitCode = process.env.FAIL_STEP === '${operation}' ? 7 : 0;
    `);
  }
  await writeFile(join(directory, 'tests/cli.test.js'), 'export {};');
  return directory;
}

function execute(directory, entry, answers = [], env = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, NODE_OPTIONS: '', DRY_RUN: 'true', TEST_MODE: 'true', ...env };
    delete childEnv.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, ['--env-file=.env', entry], {
      cwd: directory,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '', pending = '', index = 0;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Timeout CLI: ${output}`));
    }, 15000);
    child.stdout.on('data', data => {
      output += data;
      pending += data;
      if (/(Seleziona operazione|Prossima azione): $/.test(pending)) {
        pending = '';
        if (index < answers.length) child.stdin.write(`${answers[index++]}\n`);
        else child.stdin.end();
      }
    });
    child.stderr.on('data', data => { output += data; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => { clearTimeout(timeout); resolve({ code, output }); });
  });
}

for (const [choice, expected] of [['1', ['convert']], ['2', ['productor']], ['3', ['import']], ['4', ['convert', 'import']], ['5', ['test']]]) {
  test(`menu ${choice}: esegue solo gli step previsti e permette di uscire`, async t => {
    const directory = await fixture(t);
    const result = await execute(directory, 'cli.js', [choice, '6']);
    assert.equal(result.code, 0, result.output);
    const trace = await readFile(join(directory, 'trace.txt'), 'utf8');
    assert.deepEqual(trace.trim().split('\n'), expected.map(name => `${name} true true`));
    assert.match(result.output, /DRY_RUN: ATTIVO/);
    assert.match(result.output, /TEST_MODE: ATTIVO/);
    assert.match(result.output, /Completata/);
  });
}

test('uscita immediata ed EOF non eseguono operazioni', async t => {
  const directory = await fixture(t);
  for (const answers of [['6'], []]) {
    assert.equal((await execute(directory, 'cli.js', answers)).code, 0);
  }
  await assert.rejects(readFile(join(directory, 'trace.txt')), { code: 'ENOENT' });
});

test('scelte non valide, ritorno al menu e continuazione conversione → import', async t => {
  const directory = await fixture(t);
  const result = await execute(directory, 'cli.js', ['constructor', '9', '1', '9', '2', '1', '6']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Scelta non valida/);
  assert.equal(await readFile(join(directory, 'trace.txt'), 'utf8'), 'convert true true\nimport true true\n');
});

test('produttori → import e flag ereditati senza modificare .env', async t => {
  const directory = await fixture(t);
  const result = await execute(directory, 'cli.js', ['2', '2', '6'], { DRY_RUN: 'false', TEST_MODE: 'false' });
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /DRY_RUN: DISATTIVO/);
  assert.equal(await readFile(join(directory, 'trace.txt'), 'utf8'), 'productor false false\nimport false false\n');
  assert.equal(await readFile(join(directory, '.env'), 'utf8'), 'DRY_RUN=true\nTEST_MODE=true\n');
});

test('sync diretto: convert → import senza productor', async t => {
  const directory = await fixture(t);
  const result = await execute(directory, 'sync.js');
  assert.equal(result.code, 0, result.output);
  assert.equal(await readFile(join(directory, 'trace.txt'), 'utf8'), 'convert true true\nimport true true\n');
});

for (const step of ['convert', 'import']) {
  test(`sync propaga il fallimento di ${step}`, async t => {
    const directory = await fixture(t);
    const result = await execute(directory, 'sync.js', [], { FAIL_STEP: step });
    assert.equal(result.code, 7, result.output);
    assert.match(result.output, /ERRORE/);
    const trace = await readFile(join(directory, 'trace.txt'), 'utf8');
    assert.equal(trace, step === 'convert' ? 'convert true true\n' : 'convert true true\nimport true true\n');
  });
}

test('menu resta utilizzabile dopo errore e conserva exit code dello step fallito', async t => {
  const directory = await fixture(t);
  const result = await execute(directory, 'cli.js', ['4', '1', '6'], { FAIL_STEP: 'convert' });
  assert.equal(result.code, 7, result.output);
  assert.doesNotMatch(result.output, /Continua con importa/);
  assert.equal(await readFile(join(directory, 'trace.txt'), 'utf8'), 'convert true true\n');
});
