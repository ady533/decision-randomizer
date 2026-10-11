import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/server.js';

let server;
let base;
let dir;
const auth = { Authorization: 'Bearer correct horse battery' };
const json = { 'Content-Type': 'application/json' };

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'dr-test-'));
  server = createApp({ password: 'correct horse battery', dataFile: path.join(dir, 'state.json') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});

const put = (body, headers = auth) =>
  fetch(`${base}/api/state`, { method: 'PUT', headers: { ...json, ...headers }, body: JSON.stringify(body) });

test('serves the app', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /Decision Randomizer/);
  assert.equal((await fetch(`${base}/manifest.json`)).status, 200);
  assert.equal((await fetch(`${base}/icons/icon-512x512.png`)).status, 200);
});

test('does not serve files outside public/', async () => {
  for (const p of ['/../package.json', '/%2e%2e/package.json', '/..%2fserver/server.js']) {
    const res = await fetch(`${base}${p}`);
    assert.equal(res.status, 404, p);
  }
});

test('health reports sync on', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, sync: true });
});

test('state requires the password', async () => {
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  assert.equal((await fetch(`${base}/api/state`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await put({ tasks: [], history: [], baseVersion: 0 }, {})).status, 401);
});

test('saves, versions and detects conflicts', async () => {
  const initial = await (await fetch(`${base}/api/state`, { headers: auth })).json();
  assert.deepEqual(initial, { tasks: [], history: [], version: 0 });

  const data = { tasks: [{ id: '1', name: 'Write', weight: 2, extra: 'dropped' }], history: [{ name: 'Write', at: 1 }] };
  const saved = await put({ ...data, baseVersion: 0 });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { version: 1 });

  const stored = JSON.parse(await readFile(path.join(dir, 'state.json'), 'utf8'));
  assert.deepEqual(stored.tasks, [{ id: '1', name: 'Write', weight: 2 }]);

  const stale = await put({ tasks: [], history: [], baseVersion: 0 });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).state.version, 1);
});

test('rejects invalid bodies', async () => {
  assert.equal((await put({ tasks: [{ id: '1', name: 'x', weight: -1 }], history: [], baseVersion: 1 })).status, 400);
  assert.equal((await put({ tasks: [], history: [] })).status, 400);
  const bad = await fetch(`${base}/api/state`, { method: 'PUT', headers: { ...json, ...auth }, body: '{' });
  assert.equal(bad.status, 400);
});

test('sync is off without a password', async () => {
  const off = createApp({ password: '', dataFile: path.join(dir, 'off.json') });
  await new Promise(resolve => off.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${off.address().port}`;
  try {
    assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { ok: true, sync: false });
    assert.equal((await fetch(`${url}/api/state`, { headers: { Authorization: 'Bearer ' } })).status, 503);
  } finally {
    await new Promise(resolve => off.close(resolve));
  }
});
