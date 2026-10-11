// Weighted random selection. Pure functions so they can be tested in Node.

// Returns each task's chance of being picked, in the same order (sums to 1).
export function chances(tasks) {
  const total = tasks.reduce((sum, task) => sum + task.weight, 0);
  if (total <= 0) return tasks.map(() => 0);
  return tasks.map(task => task.weight / total);
}

// Picks one task with probability proportional to its weight.
// `rand` returns a number in [0, 1); injectable for tests.
export function pickWeighted(tasks, rand = Math.random) {
  if (tasks.length === 0) return null;
  const total = tasks.reduce((sum, task) => sum + task.weight, 0);
  let target = rand() * total;
  for (const task of tasks) {
    target -= task.weight;
    if (target < 0) return task;
  }
  // Floating point can leave a tiny remainder; fall back to the last task.
  return tasks[tasks.length - 1];
}

// Formats a 0..1 chance as a short percentage, e.g. 0.333 -> "33%", 0.004 -> "0.4%".
export function formatChance(chance) {
  const percent = chance * 100;
  if (percent === 0) return '0%';
  if (percent < 1) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}
