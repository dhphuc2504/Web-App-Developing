import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'student-list-'));
  const dataFile = join(directory, 'Students.JSON');
  await writeFile(dataFile, '[]\n');
  const server = createApp({ dataFile }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function client() {
    const response = await fetch(`${base}/Student`);
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const html = await response.text();
    const token = html.match(/name="formToken" value="([^"]+)"/)[1];
    return {
      html,
      post: fields => fetch(`${base}/AddStudent`, {
        method: 'POST', redirect: 'manual',
        headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(Array.isArray(fields) ? [['formToken', token], ...fields] : { formToken: token, ...fields }),
      }),
      get: () => fetch(`${base}/Student`, { headers: { Cookie: cookie } }),
      classroom: async () => {
        const response = await fetch(`${base}/Classroom`, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200);
        const html = await response.text();
        const formToken = html.match(/name="formToken" value="([^"]+)"/)?.[1];
        const revision = html.match(/name="revision" value="([^"]+)"/)?.[1];
        return { html, move: fields => fetch(`${base}/Classroom/Move`, {
          method: 'POST', redirect: 'manual',
          headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ formToken, revision, ...fields }),
        }) };
      },
    };
  }
  return { client, dataFile, base, records: async () => JSON.parse(await readFile(dataFile, 'utf8')) };
}

test('GET renders an empty list and a standard HTML form', async t => {
  const app = await fixture(t);
  const user = await app.client();
  assert.match(user.html, /Your class list starts here/);
  assert.match(user.html, /action="\/AddStudent" method="post"/);
  assert.match(user.html, /assets\/theme.js/);
  assert.equal((await fetch(`${app.base}/unknown`)).status, 404);
});

test('strict student ID format rejects IDs outside ST001–ST999', async t => {
  const app = await fixture(t);
  const user = await app.client();
  for (const id of ['ABC001', 'ST1', 'ST000', 'ST1000', 'ST-01']) {
    await user.post({ id, name: 'Alice', email: 'alice@example.com' });
    assert.match(await (await user.get()).text(), /Enter an ID from ST001 to ST999/);
  }
  assert.deepEqual(await app.records(), []);
});

test('classroom SSR places legacy students into distinct seats and persists moves', async t => {
  const app = await fixture(t);
  await writeFile(app.dataFile, JSON.stringify([
    { id: 'ST001', name: 'Alice', email: 'alice@example.com' },
    { id: 'ST002', name: 'Bob', email: 'bob@example.com' },
  ]));
  const user = await app.client();
  const room = await user.classroom();
  assert.match(room.html, /data-row="1" data-column="1"[\s\S]*?data-student-id="ST001"/);
  assert.match(room.html, /data-row="1" data-column="2"[\s\S]*?data-student-id="ST002"/);
  assert.match(room.html, /role="tooltip"/);
  const response = await room.move({ id: 'ST001', row: '3', column: '4' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/Classroom');
  const students = await app.records();
  assert.deepEqual(students[0].position, { row: 3, column: 4 });
  assert.deepEqual(students[1].position, { row: 1, column: 2 });
  assert.match((await user.classroom()).html, /data-row="3" data-column="4"[\s\S]*?data-student-id="ST001"/);
  assert.match(await (await user.get()).text(), /Row 3, seat 4/);
  await user.classroom();
  assert.deepEqual((await app.records())[0].position, { row: 3, column: 4 });
});

test('adding to a mixed legacy list assigns missing seats and renders both pages', async t => {
  const app = await fixture(t);
  await writeFile(app.dataFile, JSON.stringify([
    { id: 'ST001', name: 'Alice', email: 'alice@example.com', position: { row: 1, column: 1 } },
    { id: 'ST002', name: 'Bob', email: 'bob@example.com', position: { row: 1, column: 2 } },
    { id: 'ST003', name: 'Charlie', email: 'charlie@example.com' },
  ]));
  const user = await app.client();
  assert.match(user.html, /Row 1, seat 3/);
  assert.match((await user.classroom()).html, /data-row="1" data-column="3"[\s\S]*?data-student-id="ST003"/);
  const response = await user.post({ id: 'ST004', name: 'Dana', email: 'dana@example.com' });
  assert.equal(response.status, 303);
  assert.equal((await user.get()).status, 200);
  assert.deepEqual((await app.records()).map(student => student.position), [
    { row: 1, column: 1 }, { row: 1, column: 2 },
    { row: 1, column: 3 }, { row: 1, column: 4 },
  ]);
  assert.match((await user.classroom()).html, /data-row="1" data-column="4"[\s\S]*?data-student-id="ST004"/);
});

test('moving to an occupied seat swaps students and rejects replayed layout revisions', async t => {
  const app = await fixture(t);
  for (const [id, name] of [['ST001', 'Alice'], ['ST002', 'Bob']]) {
    const user = await app.client();
    await user.post({ id, name, email: `${name}@example.com` });
  }
  const user = await app.client();
  const room = await user.classroom();
  await room.move({ id: 'ST001', row: '1', column: '2' });
  const students = await app.records();
  assert.deepEqual(students.map(student => student.position), [{ row: 1, column: 2 }, { row: 1, column: 1 }]);
  await room.move({ id: 'ST001', row: '1', column: '2' });
  assert.match((await user.classroom()).html, /classroom changed since/);
  assert.deepEqual(await app.records(), students);
});

test('invalid seats, missing tokens, and unknown student IDs never change positions', async t => {
  const app = await fixture(t);
  const user = await app.client();
  await user.post({ id: 'ST001', name: 'Alice', email: 'alice@example.com' });
  const before = await app.records();
  for (const fields of [
    { row: '0', column: '1' }, { row: '51', column: '1' },
    { row: '1', column: '7' }, { row: '1.5', column: '1' },
    { row: '1', column: '2', formToken: '' }, { row: '1', column: '2', id: 'ST999' },
  ]) {
    const room = await user.classroom();
    await room.move({ id: 'ST001', ...fields });
    assert.match((await user.classroom()).html, /notice error/);
    assert.deepEqual(await app.records(), before);
  }
});

test('new students receive first vacant seats and concurrent moves detect conflicts', async t => {
  const app = await fixture(t);
  const alice = await app.client();
  await alice.post({ id: 'ST001', name: 'Alice', email: 'alice@example.com' });
  const room = await alice.classroom();
  await room.move({ id: 'ST001', row: '2', column: '3' });
  const bob = await app.client();
  await bob.post({ id: 'ST002', name: 'Bob', email: 'bob@example.com' });
  assert.deepEqual((await app.records())[1].position, { row: 1, column: 1 });
  const [first, second] = await Promise.all([alice.classroom(), bob.classroom()]);
  await Promise.all([
    first.move({ id: 'ST001', row: '4', column: '2' }),
    second.move({ id: 'ST002', row: '4', column: '2' }),
  ]);
  const records = await app.records();
  assert.equal(records.filter(student => student.position.row === 4 && student.position.column === 2).length, 1);
  const feedback = (await alice.classroom()).html + (await bob.classroom()).html;
  assert.match(feedback, /classroom changed since/);
});

test('invalid or overlapping saved positions cause an error without overwriting records', async t => {
  const app = await fixture(t);
  const user = await app.client();
  const data = JSON.stringify([
    { id: 'ST001', name: 'Alice', email: 'alice@example.com', position: { row: 1, column: 1 } },
    { id: 'ST002', name: 'Bob', email: 'bob@example.com', position: { row: 1, column: 1 } },
  ]);
  await writeFile(app.dataFile, data);
  assert.equal((await fetch(`${app.base}/Classroom`)).status, 500);
  assert.equal(await readFile(app.dataFile, 'utf8'), data);
});

test('successful addition persists, redirects, re-renders, and survives a new app instance', async t => {
  const app = await fixture(t);
  const user = await app.client();
  const response = await user.post({ id: ' st001 ', name: '  Nguyễn   Minh Anh  ', email: ' ANH@example.com ' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/Student');
  assert.deepEqual(await app.records(), [{ id: 'ST001', name: 'Nguyễn Minh Anh', email: 'anh@example.com', position: { row: 1, column: 1 } }]);
  const html = await (await user.get()).text();
  assert.match(html, /Nguyễn Minh Anh was added/);
  assert.match(html, /1 student/);
  assert.match(html, /anh@example.com/);
  await user.get(); // Refresh is only another GET.
  await user.post({ id: 'ST002', name: 'Different Person', email: 'different@example.com' });
  assert.match(await (await user.get()).text(), /already submitted/);
  assert.equal((await app.records()).length, 1);
  const secondServer = createApp({ dataFile: app.dataFile }).listen(0, '127.0.0.1');
  await new Promise(resolve => secondServer.once('listening', resolve));
  t.after(() => new Promise(resolve => secondServer.close(resolve)));
  const persisted = await fetch(`http://127.0.0.1:${secondServer.address().port}/Student`);
  assert.match(await persisted.text(), /anh@example.com/);
});

test('server validation preserves input and shows all errors without writing', async t => {
  const app = await fixture(t);
  const user = await app.client();
  assert.equal((await user.post({ id: 'bad id', name: 'A', email: 'wrong' })).status, 303);
  const html = await (await user.get()).text();
  assert.match(html, /id="id-error"/);
  assert.match(html, /id="name-error"/);
  assert.match(html, /id="email-error"/);
  assert.match(html, /value="BAD ID"/);
  assert.deepEqual(await app.records(), []);
  assert.doesNotMatch(await (await user.get()).text(), /id="id-error"/);
  assert.equal((await user.post({ id: 'ST001', name: 'Alice', email: 'alice@example.com' })).status, 303);
  assert.equal((await app.records()).length, 1);
});

test('duplicate IDs and emails are rejected ignoring case', async t => {
  const app = await fixture(t);
  const first = await app.client();
  await first.post({ id: 'ST001', name: 'Alice', email: 'alice@example.com' });
  const second = await app.client();
  await second.post({ id: 'st001', name: 'Bob', email: 'ALICE@example.com' });
  const html = await (await second.get()).text();
  assert.match(html, /This student ID is already/);
  assert.match(html, /This email address is already/);
  assert.equal((await app.records()).length, 1);
});

test('simultaneous writes preserve different students and reject concurrent duplicates', async t => {
  const app = await fixture(t);
  const users = await Promise.all(Array.from({ length: 8 }, () => app.client()));
  await Promise.all(users.map((user, index) => user.post({ id: `ST${String(index + 1).padStart(3, '0')}`, name: `Student ${index}`, email: `student${index}@example.com` })));
  assert.equal((await app.records()).length, 8);
  const duplicates = await Promise.all([app.client(), app.client()]);
  await Promise.all(duplicates.map(user => user.post({ id: 'ST009', name: 'Same Student', email: 'shared@example.com' })));
  assert.equal((await app.records()).length, 9);
});

test('missing tokens and repeated fields cannot bypass validation', async t => {
  const app = await fixture(t);
  const user = await app.client();
  await user.post({ formToken: '', id: 'ST001', name: 'Alice', email: 'alice@example.com' });
  assert.match(await (await user.get()).text(), /form has expired/);
  await user.post([['id', 'ST001'], ['id', 'ST002'], ['name', 'Alice'], ['email', 'alice@example.com']]);
  assert.match(await (await user.get()).text(), /id="id-error"/);
  assert.deepEqual(await app.records(), []);
});

test('names are escaped in both feedback and table HTML', async t => {
  const app = await fixture(t);
  const user = await app.client();
  await user.post({ id: 'ST001', name: '<script>alert(1)</script>', email: 'safe@example.com' });
  const html = await (await user.get()).text();
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('malformed JSON is reported without overwriting existing data', async t => {
  const app = await fixture(t);
  const user = await app.client();
  await writeFile(app.dataFile, 'broken JSON');
  assert.equal((await user.get()).status, 500);
  assert.equal((await user.post({ id: 'ST001', name: 'Alice', email: 'alice@example.com' })).status, 303);
  assert.equal(await readFile(app.dataFile, 'utf8'), 'broken JSON');
});
