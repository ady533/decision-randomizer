// App state shape, validation, and localStorage persistence.
// Shared by the browser app and the server (which imports validateState).

export const LIMITS = {
  maxTasks: 1000,
  maxNameLength: 200,
  maxHistory: 50,
};

const STORAGE_KEY = 'decision-randomizer:state';
const LEGACY_KEY = 'tasks';

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // crypto.randomUUID needs a secure context; plain-http LAN access lacks one.
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// `version` is the last server version this device has seen (0 = never synced);
// `dirty` means there are local changes the server hasn't received yet;
// `base` is the data as of that server version, used to merge with other devices.
export function emptyState() {
  return { tasks: [], history: [], version: 0, dirty: false, base: emptyData() };
}

export function emptyData() {
  return { tasks: [], history: [] };
}

export function isValidWeight(weight) {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0;
}

// Validates the synced part of the state (tasks and history).
// Returns an error message, or null if it is well formed.
export function validateData(state) {
  if (!state || typeof state !== 'object') return 'state must be an object';
  const { tasks, history } = state;
  if (!Array.isArray(tasks)) return 'tasks must be an array';
  if (tasks.length > LIMITS.maxTasks) return `at most ${LIMITS.maxTasks} tasks`;
  for (const task of tasks) {
    if (!task || typeof task !== 'object') return 'each task must be an object';
    if (typeof task.id !== 'string' || task.id === '' || task.id.length > 100) return 'task id must be a short string';
    if (typeof task.name !== 'string' || task.name.trim() === '') return 'task name must be a non-empty string';
    if (task.name.length > LIMITS.maxNameLength) return `task name must be at most ${LIMITS.maxNameLength} characters`;
    if (!isValidWeight(task.weight)) return 'task weight must be a positive number';
  }
  if (!Array.isArray(history)) return 'history must be an array';
  if (history.length > LIMITS.maxHistory) return `at most ${LIMITS.maxHistory} history entries`;
  for (const entry of history) {
    if (!entry || typeof entry !== 'object') return 'each history entry must be an object';
    if (typeof entry.name !== 'string' || entry.name.length > LIMITS.maxNameLength) return 'history name must be a short string';
    if (typeof entry.at !== 'number' || !Number.isFinite(entry.at)) return 'history time must be a number';
  }
  return null;
}

export function isValidVersion(version) {
  return Number.isSafeInteger(version) && version >= 0;
}

// Copies only the synced fields so stray properties never reach storage or the server.
export function cleanData(state) {
  return {
    tasks: state.tasks.map(({ id, name, weight }) => ({ id, name, weight })),
    history: state.history.map(({ name, at }) => ({ name, at })),
  };
}

const sameTask = (a, b) => a.name === b.name && a.weight === b.weight;
const historyKey = entry => `${entry.at}:${entry.name}`;

// Three-way merge of this device's data with the server's, task by task.
// `base` is what both started from. Each side's adds, edits and deletes are
// kept; if both changed the same task this device wins, and an edit beats a
// delete so nothing typed is lost.
export function mergeData(base, local, server) {
  const baseTasks = new Map(base.tasks.map(t => [t.id, t]));
  const localTasks = new Map(local.tasks.map(t => [t.id, t]));
  const serverIds = new Set(server.tasks.map(t => t.id));
  const changed = (task, id) => !baseTasks.has(id) || !sameTask(task, baseTasks.get(id));

  const tasks = [];
  for (const task of server.tasks) {
    const mine = localTasks.get(task.id);
    if (mine) tasks.push(changed(mine, task.id) ? mine : task);
    else if (changed(task, task.id)) tasks.push(task); // new or edited there; else deleted here
  }
  for (const task of local.tasks) {
    if (!serverIds.has(task.id) && changed(task, task.id)) tasks.push(task); // else deleted there
  }

  const localHistory = new Set(local.history.map(historyKey));
  const serverHistory = new Set(server.history.map(historyKey));
  // Entries either side removed (cleared, or pushed out by the length limit).
  const removed = new Set(base.history.map(historyKey)
    .filter(key => !localHistory.has(key) || !serverHistory.has(key)));
  const seen = new Set();
  const history = [...local.history, ...server.history]
    .filter(entry => {
      const key = historyKey(entry);
      if (removed.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, LIMITS.maxHistory);

  return cleanData({ tasks: tasks.slice(0, LIMITS.maxTasks), history });
}

// Loads state from a Storage-like object, migrating the old `tasks` format.
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (validateData(parsed) === null && isValidVersion(parsed.version)) {
        const data = cleanData(parsed);
        const dirty = parsed.dirty === true;
        // Saved before `base` existed: an unchanged device is its own base.
        const base = validateData(parsed.base) === null ? cleanData(parsed.base) : dirty ? emptyData() : data;
        return { ...data, version: parsed.version, dirty, base };
      }
    }
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy) {
      const oldTasks = JSON.parse(legacy);
      if (Array.isArray(oldTasks)) {
        const tasks = oldTasks
          .filter(t => t && typeof t.name === 'string' && t.name.trim() !== '' && isValidWeight(Number(t.weight)))
          .slice(0, LIMITS.maxTasks)
          .map(t => ({ id: makeId(), name: t.name.slice(0, LIMITS.maxNameLength), weight: Number(t.weight) }));
        return { tasks, history: [], version: 0, dirty: tasks.length > 0, base: emptyData() };
      }
    }
  } catch {
    // Corrupt or unavailable storage: start fresh rather than crash.
  }
  return emptyState();
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...cleanData(state), version: state.version, dirty: state.dirty, base: cleanData(state.base),
    }));
    storage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}
