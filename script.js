<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta http-equiv="Content-Style-Type" content="text/css">
  <title></title>
  <meta name="Generator" content="Cocoa HTML Writer">
  <meta name="CocoaVersion" content="2487.6">
  <style type="text/css">
    p.p1 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica; -webkit-text-stroke: #000000}
    p.p2 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica; -webkit-text-stroke: #000000; min-height: 14.0px}
    span.s1 {font-kerning: none}
  </style>
</head>
<body>
<p class="p1"><span class="s1">let tasks = [];</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">// Elements</span></p>
<p class="p1"><span class="s1">const taskNameInput = document.getElementById('task-name');</span></p>
<p class="p1"><span class="s1">const taskWeightInput = document.getElementById('task-weight');</span></p>
<p class="p1"><span class="s1">const addTaskButton = document.getElementById('add-task-button');</span></p>
<p class="p1"><span class="s1">const tasksList = document.getElementById('tasks');</span></p>
<p class="p1"><span class="s1">const pickTaskButton = document.getElementById('pick-task-button');</span></p>
<p class="p1"><span class="s1">const resultDiv = document.getElementById('result');</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">// Load tasks from localStorage on page load</span></p>
<p class="p1"><span class="s1">window.onload = () =&gt; {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>const storedTasks = localStorage.getItem('tasks');</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>if (storedTasks) {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>tasks = JSON.parse(storedTasks);</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>renderTasks();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>}</span></p>
<p class="p1"><span class="s1">};</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">// Add Task</span></p>
<p class="p1"><span class="s1">addTaskButton.addEventListener('click', () =&gt; {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>const name = taskNameInput.value.trim();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>const weight = parseFloat(taskWeightInput.value);</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>if (name === '' || isNaN(weight) || weight &lt;= 0) {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>alert('Please enter a valid task name and a positive weight.');</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>return;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>}</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>tasks.push({ name, weight });</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>saveTasks();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>renderTasks();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>taskNameInput.value = '';</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>taskWeightInput.value = 1;</span></p>
<p class="p1"><span class="s1">});</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">// Render Tasks</span></p>
<p class="p1"><span class="s1">function renderTasks() {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>tasksList.innerHTML = '';</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>tasks.forEach((task, index) =&gt; {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>const li = document.createElement('li');</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>li.innerHTML = `</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>&lt;span&gt;${task.name}&lt;/span&gt;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>&lt;span&gt;${task.weight}&lt;/span&gt;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>&lt;button class="delete-button" data-index="${index}"&gt;Delete&lt;/button&gt;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>`;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>tasksList.appendChild(li);</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>});</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>// Add event listeners to delete buttons</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>const deleteButtons = document.querySelectorAll('.delete-button');</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>deleteButtons.forEach(button =&gt; {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>button.addEventListener('click', (e) =&gt; {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>const index = e.target.getAttribute('data-index');</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>tasks.splice(index, 1);</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>saveTasks();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>renderTasks();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>});</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>});</span></p>
<p class="p1"><span class="s1">}</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">// Save Tasks to localStorage</span></p>
<p class="p1"><span class="s1">function saveTasks() {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>localStorage.setItem('tasks', JSON.stringify(tasks));</span></p>
<p class="p1"><span class="s1">}</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">// Normalize Weights</span></p>
<p class="p1"><span class="s1">function normalizeWeights() {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>const total = tasks.reduce((sum, task) =&gt; sum + task.weight, 0);</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>return tasks.map(task =&gt; ({</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>name: task.name,</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>normalizedWeight: task.weight / total</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>}));</span></p>
<p class="p1"><span class="s1">}</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1">// Pick a Task</span></p>
<p class="p1"><span class="s1">pickTaskButton.addEventListener('click', () =&gt; {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>if (tasks.length === 0) {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>alert('No tasks to pick from.');</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>return;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>}</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>const normalizedTasks = normalizeWeights();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>const rand = Math.random();</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>let cumulative = 0;</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>for (let task of normalizedTasks) {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>cumulative += task.normalizedWeight;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>if (rand &lt; cumulative) {</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>resultDiv.textContent = `Selected Task: ${task.name}`;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">      </span>return;</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">    </span>}</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>}</span></p>
<p class="p2"><span class="s1"></span><br></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>// Fallback in case of floating point precision issues</span></p>
<p class="p1"><span class="s1"><span class="Apple-converted-space">  </span>resultDiv.textContent = `Selected Task: ${normalizedTasks[normalizedTasks.length - 1].name}`;</span></p>
<p class="p1"><span class="s1">});</span></p>
</body>
</html>
