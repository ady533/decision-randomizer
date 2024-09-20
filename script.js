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

// Render Tasks
function renderTasks() {
  tasksList.innerHTML = '';
  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.classList.remove('highlight'); // Remove highlight if any

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
      enterEditMode(index);
    });
  });

  // Add event listeners to delete buttons
  const deleteButtons = document.querySelectorAll('.delete-button');
  deleteButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const index = e.target.getAttribute('data-index');
      tasks.splice(index, 1);
      saveTasks();
      renderTasks();
    });
  });
}

// Enter Edit Mode
function enterEditMode(index) {
  const li = tasksList.children[index];
  li.classList.add('highlight');

  const weightSpan = li.querySelector('.task-weight');
  const editButton = li.querySelector('.edit-button');

  // Create an input field with the current weight
  const weightInput = document.createElement('input');
  weightInput.type = 'number';
  weightInput.min = '0.0001'; // Allow very small positive numbers
  weightInput.step = 'any';
  weightInput.value = tasks[index].weight;
  weightInput.classList.add('edit-weight-input');

  // Replace the weight span with the input field
  li.replaceChild(weightInput, weightSpan);

  // Change Edit button to Save button
  editButton.textContent = 'Save';
  editButton.classList.remove('edit-button');
  editButton.classList.add('save-button');

  // Update the aria-label
  editButton.setAttribute('aria-label', 'Save Task');

  // Add event listener to Save button
  editButton.removeEventListener('click', () => {}); // Remove previous listeners if any
  editButton.addEventListener('click', () => {
    saveEdit(index, weightInput.value);
  });
}

// Save Edited Weight
function saveEdit(index, newWeight) {
  const trimmedWeight = newWeight.trim();
  const parsedWeight = parseFloat(trimmedWeight);

  // Validation
  if (trimmedWeight === '' || isNaN(parsedWeight) || parsedWeight <= 0) {
    alert('Please enter a valid positive number for Relative Importance.');
    return;
  }

  // Update the task's weight
  tasks[index].weight = parsedWeight;
  saveTasks();
  renderTasks();
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
