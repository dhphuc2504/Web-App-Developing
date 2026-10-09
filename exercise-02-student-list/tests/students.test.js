import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';

async function fixture(t, initial = []) {
  const directory = await mkdtemp(join(tmpdir(), 'react-students-'));
  const dataFile = join(directory, 'Students.JSON');
  await writeFile(dataFile, JSON.stringify(initial));
  const server = createApp({ dataFile }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path = '/api/students', method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  return { request, base, dataFile, records: async () => JSON.parse(await readFile(dataFile, 'utf8')) };
}
const student = (id = 'ST001') => ({ id, name: 'Example Student', email: `${id.toLowerCase()}@example.com` });

test('GET returns JSON snapshot and classroom dimensions', async t => {
  const app = await fixture(t);
  const response = await app.request();
  assert.equal(response.status, 200); assert.deepEqual(response.body.students, []);
  assert.deepEqual(response.body.classroom, { columns: 6, maxRows: 50 });
  assert.match(response.body.revision, /^[a-f0-9]{64}$/);
});
test('POST normalizes fields, assigns a seat, and persists across app instances', async t => {
  const app = await fixture(t);
  const result = await app.request('/api/students', 'POST', { id: ' st001 ', name: '  Nguyễn   Minh Anh ', email: ' ANH@EXAMPLE.COM ' });
  assert.equal(result.status, 201);
  const expected = [{ id: 'ST001', name: 'Nguyễn Minh Anh', email: 'anh@example.com', position: { row: 1, column: 1 } }];
  assert.deepEqual(result.body.students, expected); assert.deepEqual(await app.records(), expected);
  const server = createApp({ dataFile: app.dataFile }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.deepEqual((await (await fetch(`http://127.0.0.1:${server.address().port}/api/students`)).json()).students, expected);
});
test('server rejects invalid IDs, names, emails, and non-string inputs without writing', async t => {
  const app = await fixture(t);
  for (const id of ['ST000', 'ST1', 'ST1000', 'ABC001', ['ST001'], 123]) {
    const response = await app.request('/api/students', 'POST', { ...student(), id });
    assert.equal(response.status, 422); assert.ok(response.body.errors.id);
  }
  const response = await app.request('/api/students', 'POST', { id: '', name: 'A', email: 'wrong' });
  assert.deepEqual(Object.keys(response.body.errors), ['id', 'name', 'email']);
  assert.equal((await app.request('/api/students', 'POST', [])).status, 422);
  assert.deepEqual(await app.records(), []);
});
test('duplicate IDs and emails are rejected ignoring case, including retried POSTs', async t => {
  const app = await fixture(t);
  await app.request('/api/students', 'POST', student());
  const duplicate = await app.request('/api/students', 'POST', { ...student(), id: 'st001', email: 'ST001@EXAMPLE.COM' });
  assert.equal(duplicate.status, 409); assert.ok(duplicate.body.errors.id); assert.ok(duplicate.body.errors.email);
  assert.equal((await app.records()).length, 1);
});
test('mixed legacy records get distinct seats, and new additions persist all positions', async t => {
  const app = await fixture(t, [student(), { ...student('ST002'), position: { row: 1, column: 1 } }]);
  assert.deepEqual((await app.request()).body.students[0].position, { row: 1, column: 2 });
  const response = await app.request('/api/students', 'POST', student('ST003'));
  assert.equal(response.status, 201); assert.deepEqual(response.body.students[2].position, { row: 1, column: 3 });
  assert.ok((await app.records()).every(item => item.position));
});
test('PATCH moves and swaps students; stale revisions cannot overwrite newer layouts', async t => {
  const app = await fixture(t);
  await app.request('/api/students', 'POST', student());
  const initial = await app.request('/api/students', 'POST', student('ST002'));
  const move = { row: 1, column: 2, revision: initial.body.revision };
  const result = await app.request('/api/students/ST001/position', 'PATCH', move);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.students.map(item => item.position), [{ row: 1, column: 2 }, { row: 1, column: 1 }]);
  assert.equal((await app.request('/api/students/ST001/position', 'PATCH', move)).status, 409);
  const next = await app.request('/api/students/ST001/position', 'PATCH', { row: 5, column: 3, revision: result.body.revision });
  assert.equal(next.status, 200); assert.deepEqual((await app.records())[0].position, { row: 5, column: 3 });
});
test('invalid seat numbers, missing revisions, and nonexistent students are rejected', async t => {
  const app = await fixture(t); const added = await app.request('/api/students', 'POST', student());
  const before = await app.records();
  for (const fields of [{ row: 0, column: 1 }, { row: 51, column: 1 }, { row: 1, column: 7 }, { row: 1.5, column: 1 }, { row: '1', column: 1 }, { row: 1, column: 2, revision: null }]) {
    assert.equal((await app.request('/api/students/ST001/position', 'PATCH', { revision: added.body.revision, ...fields })).status, 422);
  }
  assert.equal((await app.request('/api/students/ST999/position', 'PATCH', { row: 1, column: 2, revision: added.body.revision })).status, 404);
  assert.deepEqual(await app.records(), before);
});
test('concurrent additions do not lose records; concurrent moves detect conflicts', async t => {
  const app = await fixture(t);
  await Promise.all(Array.from({ length: 8 }, (_, index) => app.request('/api/students', 'POST', student(`ST${String(index + 1).padStart(3, '0')}`))));
  assert.equal((await app.records()).length, 8);
  const { body } = await app.request();
  const moves = await Promise.all(['ST001', 'ST002'].map(id => app.request(`/api/students/${id}/position`, 'PATCH', { row: 4, column: 2, revision: body.revision })));
  assert.deepEqual(moves.map(result => result.status).sort(), [200, 409]);
  assert.equal((await app.records()).filter(item => item.position.row === 4 && item.position.column === 2).length, 1);
});
test('bad JSON and unsupported content types return JSON errors', async t => {
  const app = await fixture(t);
  const malformed = await fetch(`${app.base}/api/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
  assert.equal(malformed.status, 400); assert.ok((await malformed.json()).message);
  const form = await fetch(`${app.base}/api/students`, { method: 'POST', body: new URLSearchParams(student()) });
  assert.equal(form.status, 415);
  assert.equal((await app.request('/api/missing')).status, 404);
});
test('corrupted storage and overlapping positions fail without overwriting data', async t => {
  const app = await fixture(t);
  await writeFile(app.dataFile, 'broken JSON');
  assert.equal((await app.request()).status, 500);
  assert.equal((await app.request('/api/students', 'POST', student())).status, 500);
  assert.equal(await readFile(app.dataFile, 'utf8'), 'broken JSON');
  const invalid = [student(), student('ST002')].map(item => ({ ...item, position: { row: 1, column: 1 } }));
  await writeFile(app.dataFile, JSON.stringify(invalid));
  assert.equal((await app.request()).status, 500); assert.deepEqual(await app.records(), invalid);
});
