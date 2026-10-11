import { chances, formatChance, pickWeighted } from './picker.js';
import { LIMITS, cleanData, isValidWeight, loadState, makeId, saveState } from './state.js';
import { AuthError, createSyncClient } from './sync.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// localStorage can throw (private mode, blocked storage); fall back to memory.
const storage = (() => {
  try {
    localStorage.setItem('decision-randomizer:probe', '1');
    localStorage.removeItem('decision-randomizer:probe');
    return localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: key => memory.delete(key),
    };
  }
})();

const $ = id => document.getElementById(id);
const el = {
  notification: $('notification'),
  addForm: $('add-task-form'),
  taskName: $('task-name'),
  taskWeight: $('task-weight'),
  tasks: $('tasks'),
  emptyTasks: $('empty-tasks'),
  pickButton: $('pick-task-button'),
  resultText: $('result-text'),
  resultActions: $('result-actions'),
  doneButton: $('done-button'),
  pickAgainButton: $('pick-again-button'),
  history: $('history'),
  emptyHistory: $('empty-history'),
  clearHistoryButton: $('clear-history-button'),
  syncSection: $('sync-section'),
  syncStatus: $('sync-status'),
  syncForm: $('sync-form'),
  syncPassword: $('sync-password'),
  syncConnected: $('sync-connected'),
  syncNowButton: $('sync-now-button'),
  syncDisconnectButton: $('sync-disconnect-button'),
};

let state = loadState(storage);
let editingId = null;
let pickedId = null;
let editCount = 0; // bumps on every local change; lets sync spot edits made mid-request

// ---------- State changes ----------

// Applies a local change, saves it, re-renders and queues a sync.
function update(change) {
  change(state);
  state.dirty = true;
  editCount++;
  saveState(storage, state);
  render();
  scheduleSync();
}

function addTask(name, weight) {
  update(s => s.tasks.push({ id: makeId(), name, weight }));
}

function removeTask(id) {
  update(s => { s.tasks = s.tasks.filter(task => task.id !== id); });
  if (pickedId === id) clearResult();
}

function editTask(id, name, weight) {
  update(s => {
    const task = s.tasks.find(t => t.id === id);
    if (task) Object.assign(task, { name, weight });
  });
}

function recordPick(task) {
  update(s => {
    s.history.unshift({ name: task.name, at: Date.now() });
    s.history.length = Math.min(s.history.length, LIMITS.maxHistory);
  });
}

// ---------- Rendering ----------

function render() {
  renderTasks();
  renderHistory();
}

function renderTasks() {
  const odds = chances(state.tasks);
  el.tasks.replaceChildren(...state.tasks.map((task, i) =>
    task.id === editingId ? editRow(task) : taskRow(task, odds[i])));
  el.emptyTasks.classList.toggle('hidden', state.tasks.length > 0);
}

function taskRow(task, chance) {
  const li = document.createElement('li');
  li.dataset.id = task.id;
  li.append(
    span('task-name', task.name),
    span('task-weight', String(task.weight), `Importance ${task.weight}`),
    span('task-chance', formatChance(chance), `${formatChance(chance)} chance`),
    button('Edit', 'edit-button', 'edit', `Edit ${task.name}`),
    button('Delete', 'delete-button', 'delete', `Delete ${task.name}`),
  );
  return li;
}

function editRow(task) {
  const li = document.createElement('li');
  li.dataset.id = task.id;
  li.classList.add('editing');

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = task.name;
  nameInput.maxLength = LIMITS.maxNameLength;
  nameInput.className = 'edit-name-input';
  nameInput.setAttribute('aria-label', 'Task name');

  const weightInput = document.createElement('input');
  weightInput.type = 'number';
  weightInput.min = '0.0001';
  weightInput.step = 'any';
  weightInput.value = task.weight;
  weightInput.className = 'edit-weight-input';
  weightInput.setAttribute('aria-label', 'Relative importance');

  li.append(
    nameInput,
    weightInput,
    button('Save', 'save-button', 'save', 'Save task'),
    button('Cancel', 'secondary-button', 'cancel', 'Cancel editing'),
  );
  return li;
}

function span(className, text, label) {
  const s = document.createElement('span');
  s.className = className;
  s.textContent = text;
  if (label) s.setAttribute('aria-label', label);
  return s;
}

function button(text, className, action, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.dataset.action = action;
  b.textContent = text;
  b.setAttribute('aria-label', label);
  return b;
}

function renderHistory() {
  el.history.replaceChildren(...state.history.slice(0, 10).map(entry => {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.dateTime = new Date(entry.at).toISOString();
    time.textContent = formatTime(entry.at);
    li.append(span('history-name', entry.name), time);
    return li;
  }));
  const empty = state.history.length === 0;
  el.emptyHistory.classList.toggle('hidden', !empty);
  el.clearHistoryButton.classList.toggle('hidden', empty);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function showResult(task) {
  pickedId = task.id;
  el.resultText.textContent = `Selected Task: ${task.name}`;
  el.resultActions.classList.remove('hidden');
}

function clearResult() {
  pickedId = null;
  el.resultText.textContent = '';
  el.resultActions.classList.add('hidden');
}

let notificationTimer;
function showNotification(message, type = 'success') {
  el.notification.textContent = message;
  el.notification.className = `notification ${type}`;
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => el.notification.classList.add('hidden'), 3000);
}

// ---------- Input handling ----------

function readWeight(value) {
  const weight = Number.parseFloat(value);
  return isValidWeight(weight) ? weight : null;
}

el.addForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = el.taskName.value.trim();
  const weight = readWeight(el.taskWeight.value);
  if (name === '') return showNotification('Please enter a valid task name.', 'error');
  if (weight === null) return showNotification('Please enter a positive number for Relative Importance.', 'error');
  if (state.tasks.length >= LIMITS.maxTasks) return showNotification(`You can have at most ${LIMITS.maxTasks} tasks.`, 'error');
  addTask(name, weight);
  el.taskName.value = '';
  el.taskName.focus();
  showNotification('Task added.');
});

function saveEditRow(li) {
  const name = li.querySelector('.edit-name-input').value.trim();
  const weight = readWeight(li.querySelector('.edit-weight-input').value);
  if (name === '') return showNotification('Please enter a valid task name.', 'error');
  if (weight === null) return showNotification('Please enter a valid positive number for Relative Importance.', 'error');
  editingId = null;
  editTask(li.dataset.id, name, weight);
  showNotification('Task updated.');
}

el.tasks.addEventListener('click', event => {
  const action = event.target.closest('button')?.dataset.action;
  const li = event.target.closest('li');
  if (!action || !li) return;
  const id = li.dataset.id;

  if (action === 'edit') {
    editingId = id;
    renderTasks();
    el.tasks.querySelector('.edit-name-input')?.focus();
  } else if (action === 'cancel') {
    editingId = null;
    renderTasks();
  } else if (action === 'save') {
    saveEditRow(li);
  } else if (action === 'delete') {
    if (editingId === id) editingId = null;
    removeTask(id);
    showNotification('Task deleted.');
  }
});

el.tasks.addEventListener('keydown', event => {
  const li = event.target.closest('li.editing');
  if (!li) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    saveEditRow(li);
  } else if (event.key === 'Escape') {
    editingId = null;
    renderTasks();
  }
});

function pick() {
  const task = pickWeighted(state.tasks);
  if (!task) return showNotification('No tasks to pick from.', 'error');
  showResult(task);
  recordPick(task);
}

el.pickButton.addEventListener('click', pick);
el.pickAgainButton.addEventListener('click', pick);

el.doneButton.addEventListener('click', () => {
  const task = state.tasks.find(t => t.id === pickedId);
  if (!task) return clearResult();
  removeTask(task.id);
  showNotification(`Removed "${task.name}".`);
});

el.clearHistoryButton.addEventListener('click', () => {
  update(s => { s.history = []; });
});

// ---------- Sync ----------

const sync = createSyncClient({ storage });
let syncTimer;
let syncing = false;
let syncAgain = false;

function isConnected() {
  return Boolean(sync.getPassword());
}

function renderSync(status = '') {
  const connected = isConnected();
  el.syncForm.classList.toggle('hidden', connected);
  el.syncConnected.classList.toggle('hidden', !connected);
  el.syncStatus.textContent = status || (connected ? '(connected)' : '(off)');
}

function scheduleSync() {
  if (!isConnected()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, 400);
}

function adoptServerState(server) {
  state = { ...cleanData(server), version: server.version, dirty: false };
  if (editingId && !state.tasks.some(t => t.id === editingId)) editingId = null;
  if (pickedId && !state.tasks.some(t => t.id === pickedId)) clearResult();
  saveState(storage, state);
  render();
}

// Brings this device and the server in line. Local changes win unless another
// device saved in the meantime, in which case the server's copy is loaded.
async function runSync({ firstConnect = false } = {}) {
  if (!isConnected()) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  renderSync('(syncing…)');
  try {
    const server = await sync.pull();
    if (firstConnect && server.version > 0 && state.dirty && state.tasks.length > 0) {
      const useServer = confirm(
        `The server already has ${server.tasks.length} task(s). ` +
        'OK loads the server\'s tasks on this device. Cancel replaces the server\'s tasks with this device\'s.');
      if (useServer) adoptServerState(server);
      else state.version = server.version;
    }
    if (state.dirty) {
      if (state.version !== server.version) {
        adoptServerState(server);
        showNotification('Another device changed your tasks, so the latest version was loaded.', 'error');
      } else {
        const editsBeforePush = editCount;
        const result = await sync.push(cleanData(state), state.version);
        if (result.ok) {
          state.version = result.version;
          state.dirty = editCount !== editsBeforePush;
          saveState(storage, state);
          if (state.dirty) syncAgain = true;
        } else {
          adoptServerState(result.state);
          showNotification('Another device changed your tasks, so the latest version was loaded.', 'error');
        }
      }
    } else if (server.version !== state.version) {
      adoptServerState(server);
    }
    renderSync();
  } catch (err) {
    if (err instanceof AuthError) {
      sync.setPassword(null);
      renderSync();
      showNotification(err.message, 'error');
    } else {
      // Offline or server down: changes stay local and sync next time.
      renderSync('(offline)');
    }
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      runSync();
    }
  }
}

el.syncForm.addEventListener('submit', async event => {
  event.preventDefault();
  const password = el.syncPassword.value;
  if (!password) return;
  sync.setPassword(password);
  el.syncPassword.value = '';
  renderSync();
  await runSync({ firstConnect: true });
  if (isConnected()) showNotification('Connected to sync.');
});

el.syncNowButton.addEventListener('click', () => runSync());

el.syncDisconnectButton.addEventListener('click', () => {
  sync.setPassword(null);
  renderSync();
});

window.addEventListener('focus', () => runSync());
window.addEventListener('online', () => runSync());

sync.isAvailable().then(available => {
  if (!available) return;
  el.syncSection.classList.remove('hidden');
  renderSync();
  runSync();
});

render();
