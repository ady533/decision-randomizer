import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadState, saveState, validateData } from '../public/js/state.js';

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
  assert.deepEqual(state, { tasks: [], history: [], version: 0, dirty: false });
});

test('validateData rejects bad input', () => {
  assert.equal(validateData({ tasks: [], history: [] }), null);
  assert.match(validateData({ tasks: [{ id: 'a', name: 'x', weight: 0 }], history: [] }), /weight/);
  assert.match(validateData({ tasks: [{ id: 'a', name: ' ', weight: 1 }], history: [] }), /name/);
  assert.match(validateData({ tasks: 'nope', history: [] }), /tasks/);
});
