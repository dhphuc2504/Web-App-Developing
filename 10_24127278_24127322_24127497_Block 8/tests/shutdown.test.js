import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { installShutdown } from '../src/lib/shutdown.js';

function fixture({ close, disconnect = async () => {}, timeoutMs = 1000 }) {
  const processRef = new EventEmitter();
  const exits = [], messages = [];
  let closeCalls = 0, disconnectCalls = 0, forceCalls = 0;
  processRef.exit = code => exits.push(code);
  const server = {
    close(done) { closeCalls++; close(done); },
    closeIdleConnections() {},
    closeAllConnections() { forceCalls++; },
  };
  const db = { async $disconnect() { disconnectCalls++; await disconnect(); } };
  const logger = { log: value => messages.push(value), error: value => messages.push(value) };
  const stop = installShutdown({ server, db, processRef, logger, timeoutMs });
  return { processRef, exits, messages, stop, counts: () => ({ closeCalls, disconnectCalls, forceCalls }) };
}

test('repeated Ctrl+C and SIGTERM share one shutdown without adding close listeners', async () => {
  let complete;
  const f = fixture({ close: done => { complete = done; } });
  f.processRef.emit('SIGINT');
  const pending = f.stop();
  await Promise.resolve();
  for (let i = 0; i < 15; i++) {
    f.processRef.emit(i % 2 ? 'SIGINT' : 'SIGTERM');
    assert.equal(f.stop(), pending);
  }
  assert.equal(f.counts().closeCalls, 1);
  complete();
  await pending;
  assert.deepEqual(f.exits, [0]);
  assert.deepEqual(f.counts(), { closeCalls: 1, disconnectCalls: 1, forceCalls: 0 });
  assert.equal(f.messages.length, 1);
  assert.equal(f.processRef.listenerCount('SIGINT'), 0);
  assert.equal(f.processRef.listenerCount('SIGTERM'), 0);
});

test('shutdown disconnects the database only after HTTP connections close', async () => {
  let complete;
  const f = fixture({ close: done => { complete = done; } });
  const pending = f.stop();
  await Promise.resolve();
  assert.equal(f.counts().disconnectCalls, 0);
  complete();
  await pending;
  assert.equal(f.counts().disconnectCalls, 1);
  assert.deepEqual(f.exits, [0]);
});

test('an unfinished HTTP request cannot block shutdown past the deadline', async () => {
  const f = fixture({ close() {}, timeoutMs: 20 });
  await f.stop();
  assert.deepEqual(f.exits, [1]);
  assert.deepEqual(f.counts(), { closeCalls: 1, disconnectCalls: 0, forceCalls: 1 });
  assert.match(f.messages.at(-1), /Shutdown timed out/);
});

test('a stalled database disconnect cannot block shutdown past the deadline', async () => {
  const f = fixture({ close: done => done(), disconnect: () => new Promise(() => {}), timeoutMs: 20 });
  await f.stop();
  assert.deepEqual(f.exits, [1]);
  assert.deepEqual(f.counts(), { closeCalls: 1, disconnectCalls: 1, forceCalls: 1 });
});

test('shutdown handles an already closed server and protects error details', async () => {
  const closed = fixture({ close: done => done({ code: 'ERR_SERVER_NOT_RUNNING' }) });
  await closed.stop();
  assert.deepEqual(closed.exits, [0]);
  const failed = fixture({ close: done => done(), disconnect: async () => { throw new Error('fixture-password postgres://fixture-host'); } });
  await failed.stop();
  assert.deepEqual(failed.exits, [1]);
  assert.doesNotMatch(failed.messages.join('\n'), /fixture-password|postgres:|fixture-host/);
});

test('a real child process exits on Ctrl+C even when database cleanup stalls', { timeout: 5000 }, async () => {
  const moduleUrl = new URL('../src/lib/shutdown.js', import.meta.url).href;
  const script = `
    import { installShutdown } from ${JSON.stringify(moduleUrl)};
    const cleanup = setInterval(() => {}, 1000);
    installShutdown({
      server: { close(done) { done(); }, closeAllConnections() {} },
      db: { $disconnect() { return new Promise(() => {}); } },
      cleanup,
      timeoutMs: 50,
    });
    console.log('READY');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = '';
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.stdout.on('data', data => {
        output += data;
        if (output.includes('READY')) resolve();
      });
      child.stderr.on('data', data => { errors += data; });
      child.once('exit', () => reject(new Error('Fixture exited before readiness.')));
    });
    child.kill('SIGINT');
    const result = await exited;
    assert.deepEqual(result, { code: 1, signal: null });
    assert.match(errors, /Shutdown timed out/);
    assert.doesNotMatch(errors, /MaxListenersExceededWarning/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});
