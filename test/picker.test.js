import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chances, formatChance, pickWeighted } from '../public/js/picker.js';

const tasks = [
  { id: 'a', name: 'A', weight: 1 },
  { id: 'b', name: 'B', weight: 3 },
];

test('chances are proportional to weight', () => {
  assert.deepEqual(chances(tasks), [0.25, 0.75]);
  assert.deepEqual(chances([]), []);
});

test('pickWeighted maps the random number onto weight ranges', () => {
  assert.equal(pickWeighted(tasks, () => 0), tasks[0]);
  assert.equal(pickWeighted(tasks, () => 0.2499), tasks[0]);
  assert.equal(pickWeighted(tasks, () => 0.25), tasks[1]);
  assert.equal(pickWeighted(tasks, () => 0.9999999), tasks[1]);
  assert.equal(pickWeighted([], () => 0.5), null);
});

test('pickWeighted matches the weights over many draws', () => {
  let seed = 42;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 20000; i++) counts[pickWeighted(tasks, rand).id]++;
  assert.ok(Math.abs(counts.b / 20000 - 0.75) < 0.02, `got ${counts.b / 20000}`);
});

test('formatChance', () => {
  assert.equal(formatChance(0.333), '33%');
  assert.equal(formatChance(0.004), '0.4%');
  assert.equal(formatChance(0), '0%');
});
