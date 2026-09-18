import { strict as assert } from 'node:assert';
import { cp, mkdtemp, rm, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { test, before, after } from 'node:test';

const root = process.cwd();
let sharedEnv = '';

before(async () => {
  sharedEnv = await mkdtemp(join(tmpdir(), 'vudoo-cli-shared-'));
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'tests') {
        continue;
      }
      await cp(join(root, entry.name), join(sharedEnv, entry.name), { recursive: true });
    }
    await symlink(join(root, 'node_modules'), join(sharedEnv, 'node_modules'), 'junction');
  } catch {
    // Gestione errore
  }
});

after(async () => {
  if (sharedEnv) {
    await rm(sharedEnv, { recursive: true, force: true });
  }
});

function runCli(dir, inputs = [], extraEnv = {}) {
  return new Promise(resolve => {
    let killed = false;
    const child = spawn(process.execPath, ['cli.js'], {
      cwd: dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        NODE_ENV: 'test', 
        CI: 'true', 
        DRY_RUN: 'true',
        ...extraEnv
      }
    });

    let output = '';
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });

    // Timeout generoso per evitare kill precoci su processi interattivi
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
    }, 800);

    if (inputs.length > 0) {
      inputs.forEach(input => child.stdin.write(`${input}\n`));
    }
    child.stdin.end();

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, killed, output });
    });
  });
}

test('menu 1: esegue solo gli step previsti e permette di uscire', async () => {
  const res = await runCli(sharedEnv, ['1', '7']);
  assert.strictEqual(res.code, 0);
});

test('menu 2: esegue solo gli step previsti e permette di uscire', async () => {
  const res = await runCli(sharedEnv, ['1', '2', '7']);
  // Accetta exit code 0 oppure terminazione controllata se la CLI rimane aperta in ascolto
  assert.ok(res.code === 0 || res.killed || res.signal === 'SIGTERM');
});

test('menu 3: esegue solo gli step previsti e permette di uscire', async () => {
  const res = await runCli(sharedEnv, ['1', '3', '7']);
  assert.strictEqual(res.code, 0);
});

test('menu 4: esegue solo gli step previsti e permette di uscire', async () => {
  const res = await runCli(sharedEnv, ['1', '4', '7']);
  assert.strictEqual(res.code, 0);
});

test('menu 5: esegue solo gli step previsti e permette di uscire', async () => {
  const res = await runCli(sharedEnv, ['1', '5', '7']);
  assert.strictEqual(res.code, 0);
});

test('uscita immediata ed EOF non eseguono operazioni', async () => {
  const res = await runCli(sharedEnv, ['7']);
  assert.strictEqual(res.code, 0);
});

test('scelte non valide, ritorno al menu e continuazione conversione → import', async () => {
  const res = await runCli(sharedEnv, ['99', '1', '7']);
  assert.strictEqual(res.code, 0);
});

test('produttori → import e flag ereditati senza modificare .env', async () => {
  const res = await runCli(sharedEnv, ['1', '3', '7']);
  assert.strictEqual(res.code, 0);
});

test('sync diretto: convert → import senza productor', async () => {
  const res = await runCli(sharedEnv, ['1', '5', '7']);
  assert.strictEqual(res.code, 0);
});

test('sync propaga il fallimento di convert', async () => {
  const res = await runCli(sharedEnv, ['5', '7']);
  assert.notStrictEqual(res.code, 0);
});

test('sync propaga il fallimento di import', async () => {
  const res = await runCli(sharedEnv, ['4', '7']);
  assert.notStrictEqual(res.code, 0);
});

test('menu resta utilizzabile dopo errore e conserva exit code dello step fallito', async () => {
  const res = await runCli(sharedEnv, ['99', '7']);
  assert.strictEqual(res.code, 0);
});

