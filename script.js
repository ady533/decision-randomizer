// script.js

// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
      }, err => {
        console.log('ServiceWorker registration failed:', err);
      });
  });
}

let tasks = [];

// Elements
const taskNameInput = document.getElementById('task-name');
const taskWeightInput = document.getElementById('task-weight');
const addTaskButton = document.getElementById('add-task-button');
const bulkTasksInput = document.getElementById('bulk-tasks-input');
const bulkAddTaskButton = document.getElementById('bulk-add-task-button');
const tasksList = document.getElementById('tasks');
const pickTaskButton = document.getElementById('pick-task-button');
const resultDiv = document.getElementById('result');

// Add Task
addTaskButton.addEventListener('click', () => {
  const name = taskNameInput.value.trim();
  const weight = parseFloat(taskWeightInput.value);

  // Validation
  if (name === '') {
    alert('Please enter a valid task name.');
    return;
  }

  if (isNaN(weight) || weight <= 0) {
    alert('Please enter a positive number for Relative Importance.');
    return;
  }

  tasks.push({ name, weight });
  saveTasks();
  renderTasks();
  taskNameInput.value = '';
  taskWeightInput.value = 1;
});

// Bulk Add Task
bulkAddTaskButton.addEventListener('click', () => {
  const bulkInput = bulkTasksInput.value.trim();
  if (bulkInput === '') {
    alert('Please enter tasks to add.');
    return;
  }

  const lines = bulkInput.split('\n');
  const newTasks = [];

  for (let line of lines) {
    // Split by comma
    const parts = line.split(',');
    if (parts.length !== 2) {
      alert(`Invalid format in line: "${line}". Expected format: Task Name, Relative Importance`);
      continue;
    }

    const name = parts[0].trim();
    const weight = parseFloat(parts[1].trim());

    if (name === '') {
      alert(`Task name cannot be empty in line: "${line}".`);
      continue;
    }

    if (isNaN(weight) || weight <= 0) {
      alert(`Invalid Relative Importance in line: "${line}". Please enter a positive number.`);
      continue;
    }

    newTasks.push({ name, weight });
  }

  if (newTasks.length > 0) {
    tasks = tasks.concat(newTasks);
    saveTasks();
    renderTasks();
    bulkTasksInput.value = '';
    alert(`${newTasks.length} tasks added successfully.`);
  }
});

// Render Tasks
function renderTasks() {
  tasksList.innerHTML = '';
  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="task-name">${task.name}</span>
      <span class="task-weight">${task.weight}</span>
      <button class="edit-button" data-index="${index}" aria-label="Edit Task">Edit</button>
      <button class="delete-button" data-index="${index}" aria-label="Delete Task">Delete</button>
    `;
    tasksList.appendChild(li);
  });

  // Add event listeners to edit buttons
  const editButtons = document.querySelectorAll('.edit-button');
  editButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const index = e.target.getAttribute('data-index');
      editTask(index);
    });
  });

  // Add event listeners to delete buttons
  const deleteButtons = document.querySelectorAll('.delete-button');
  deleteButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const index = e.target.getAttribute('data-index');
      deleteTask(index);
    });
  });
}

// Edit Task
function editTask(index) {
  const li = tasksList.children[index];
  const task = tasks[index];
  
  // Replace the weight span with an input field
  const weightSpan = li.querySelector('.task-weight');
  const editButton = li.querySelector('.edit-button');

  if (editButton.textContent === 'Edit') {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0.1';
    input.step = 'any';
    input.value = task.weight;
    input.classList.add('edit-weight-input');
    input.style.width = '60px';

    weightSpan.innerHTML = '';
    weightSpan.appendChild(input);
    editButton.textContent = 'Save';
    editButton.classList.remove('edit-button');
    editButton.classList.add('save-button');

    // Add event listener for save
    editButton.addEventListener('click', () => {
      const newWeight = parseFloat(input.value);
      if (isNaN(newWeight) || newWeight <= 0) {
        alert('Please enter a valid positive number for Relative Importance.');
        return;
      }
      tasks[index].weight = newWeight;
      saveTasks();
      renderTasks();
    });
  }
}

// Delete Task
function deleteTask(index) {
  if (confirm(`Are you sure you want to delete the task "${tasks[index].name}"?`)) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
  }
}

// Save Tasks to localStorage
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Load tasks from localStorage on page load
window.onload = () => {
  const storedTasks = localStorage.getItem('tasks');
  if (storedTasks) {
    tasks = JSON.parse(storedTasks);
    renderTasks();
  }
}

// Normalize Weights
function normalizeWeights() {
  const total = tasks.reduce((sum, task) => sum + task.weight, 0);
  return tasks.map(task => ({
    name: task.name,
    normalizedWeight: task.weight / total
  }));
}

// Pick a Task
pickTaskButton.addEventListener('click', () => {
  if (tasks.length === 0) {
    alert('No tasks to pick from.');
    return;
  }

  const normalizedTasks = normalizeWeights();
  const rand = Math.random();
  let cumulative = 0;

  for (let task of normalizedTasks) {
    cumulative += task.normalizedWeight;
    if (rand < cumulative) {
      resultDiv.textContent = `Selected Task: ${task.name}`;
      return;
    }
  }

  // Fallback in case of floating point precision issues
  resultDiv.textContent = `Selected Task: ${normalizedTasks[normalizedTasks.length - 1].name}`;
});
