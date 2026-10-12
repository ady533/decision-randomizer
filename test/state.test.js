import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadState, mergeData, saveState, validateData } from '../public/js/state.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    map,
  };
}

test('migrates the old tasks format and drops invalid entries', () => {
  const storage = memoryStorage({
    tasks: JSON.stringify([{ name: 'Old', weight: 2 }, { name: '', weight: 1 }, { name: 'Bad', weight: -1 }]),
  });
  const state = loadState(storage);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].name, 'Old');
  assert.equal(state.tasks[0].weight, 2);
  assert.ok(state.tasks[0].id);
  assert.equal(state.dirty, true);

  saveState(storage, state);
  assert.equal(storage.getItem('tasks'), null);
  assert.deepEqual(loadState(storage), state);
});

test('corrupt storage starts fresh', () => {
  const state = loadState(memoryStorage({ 'decision-randomizer:state': '{not json' }));
  assert.deepEqual(state, { tasks: [], history: [], version: 0, dirty: false, base: { tasks: [], history: [] } });
});

test('validateData rejects bad input', () => {
  assert.equal(validateData({ tasks: [], history: [] }), null);
  assert.match(validateData({ tasks: [{ id: 'a', name: 'x', weight: 0 }], history: [] }), /weight/);
  assert.match(validateData({ tasks: [{ id: 'a', name: ' ', weight: 1 }], history: [] }), /name/);
  assert.match(validateData({ tasks: 'nope', history: [] }), /tasks/);
});

const task = (id, name = id, weight = 1) => ({ id, name, weight });

test('mergeData keeps adds, edits and deletes from both sides', () => {
  const base = { tasks: [task('a'), task('b'), task('c'), task('d')], history: [] };
  const local = { tasks: [task('a', 'a edited'), task('c'), task('d'), task('new-local')], history: [] }; // deleted b
  const server = { tasks: [task('a'), task('b'), task('c', 'c', 5), task('new-server')], history: [] }; // deleted d
  assert.deepEqual(mergeData(base, local, server).tasks, [
    task('a', 'a edited'), task('c', 'c', 5), task('new-server'), task('new-local'),
  ]);
});

test('mergeData: an edit beats a delete, and this device wins a double edit', () => {
  const base = { tasks: [task('a'), task('b'), task('c')], history: [] };
  const local = { tasks: [task('a', 'mine'), task('c', 'mine too')], history: [] }; // deleted b
  const server = { tasks: [task('b', 'theirs'), task('c', 'theirs too')], history: [] }; // deleted a
  assert.deepEqual(mergeData(base, local, server).tasks, [
    task('b', 'theirs'), task('c', 'mine too'), task('a', 'mine'),
  ]);
});

test('mergeData with an empty base keeps everything from both', () => {
  const none = { tasks: [], history: [] };
  const merged = mergeData(none, { tasks: [task('a')], history: [] }, { tasks: [task('b')], history: [] });
  assert.deepEqual(merged.tasks, [task('b'), task('a')]);
});

test('mergeData merges history, newest first, honouring removals', () => {
  const h = at => ({ name: `pick ${at}`, at });
  const base = { tasks: [], history: [h(2), h(1)] };
  assert.deepEqual(mergeData(base, { tasks: [], history: [h(4), h(2), h(1)] }, { tasks: [], history: [h(3), h(2), h(1)] }).history,
    [h(4), h(3), h(2), h(1)]);
  // Cleared on this device, one new pick on the other.
  assert.deepEqual(mergeData(base, { tasks: [], history: [] }, { tasks: [], history: [h(3), h(2), h(1)] }).history, [h(3)]);
});

test('state saved before base existed loads with a usable base', () => {
  const saved = { tasks: [task('a')], history: [], version: 3 };
  const clean = loadState(memoryStorage({ 'decision-randomizer:state': JSON.stringify({ ...saved, dirty: false }) }));
  assert.deepEqual(clean.base, { tasks: [task('a')], history: [] });
  const dirty = loadState(memoryStorage({ 'decision-randomizer:state': JSON.stringify({ ...saved, dirty: true }) }));
  assert.deepEqual(dirty.base, { tasks: [], history: [] });
});
