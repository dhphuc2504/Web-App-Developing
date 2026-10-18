import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { listenForStartup, startupFailureMessage } from '../src/lib/startup.js';

test('startup catches an occupied-port error instead of an unhandled server error', async () => {
  const server = new EventEmitter();
  const error = Object.assign(new Error('Port is occupied'), { code: 'EADDRINUSE' });
  const app = { listen() { queueMicrotask(() => server.emit('error', error)); return server; } };
  await assert.rejects(listenForStartup(app, 3000), { code: 'EADDRINUSE' });
  assert.equal(server.listenerCount('listening'), 0);
  const message = startupFailureMessage(error, 3000);
  assert.match(message, /Port 3000 is already in use/);
  assert.match(message, /PORT=3002/);
});

test('startup waits until the server is actually listening', async () => {
  const server = new EventEmitter();
  let settled = false;
  const listening = listenForStartup({ listen() { return server; } }, 3002).then(value => { settled = true; return value; });
  await Promise.resolve();
  assert.equal(settled, false);
  server.emit('listening');
  assert.equal(await listening, server);
  assert.equal(server.listenerCount('error'), 0);
});

test('startup diagnostics omit sensitive details from database and bind failures', () => {
  const privateDetail = 'postgresql://sample:fixture-password@fixture-host/db';
  for (const code of ['P1001', 'EADDRINUSE']) {
    const error = Object.assign(new Error(privateDetail), { code, detail: privateDetail });
    const message = startupFailureMessage(error, 3000);
    assert.doesNotMatch(message, /fixture-password|fixture-host|postgresql:/);
  }
});
