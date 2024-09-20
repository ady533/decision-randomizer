let tasks = [];

// Elements
const taskNameInput = document.getElementById('task-name');
const taskWeightInput = document.getElementById('task-weight');
const addTaskButton = document.getElementById('add-task-button');
const tasksList = document.getElementById('tasks');
const pickTaskButton = document.getElementById('pick-task-button');
const resultDiv = document.getElementById('result');

// Load tasks from localStorage on page load
window.onload = () => {
  const storedTasks = localStorage.getItem('tasks');
  if (storedTasks) {
    tasks = JSON.parse(storedTasks);
    renderTasks();
  }
};

// Add Task
addTaskButton.addEventListener('click', () => {
  const name = taskNameInput.value.trim();
  const weight = parseFloat(taskWeightInput.value);

  if (name === '' || isNaN(weight) || weight <= 0) {
    alert('Please enter a valid task name and a positive weight.');
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
    li.innerHTML = `
      <span>${task.name}</span>
      <span>${task.weight}</span>
      <button class="delete-button" data-index="${index}">Delete</button>
    `;
    tasksList.appendChild(li);
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

// Save Tasks to localStorage
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
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
