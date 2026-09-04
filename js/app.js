/* ============================================================
   app.js — Focus Dashboard
   Modules:
   1. Helpers & Storage
   2. Theme (Light / Dark)
   3. Greeting & Clock
   4. Custom Name
   5. Focus Timer
   6. To-Do List (Add, Edit, Delete, Complete, Sort, No-Duplicates)
   7. Quick Links
   8. Toast Notifications
   9. Init
============================================================ */

'use strict';

/* ── 1. Helpers & Storage ───────────────────────────────── */

const $ = (id) => document.getElementById(id);

const storage = {
  get: (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  },
};

/* ── 2. Theme (Light / Dark) ────────────────────────────── */

const ThemeModule = (() => {
  const STORAGE_KEY = 'fd_theme';
  const html        = document.documentElement;
  const toggleBtn   = $('themeToggle');
  const iconEl      = $('themeIcon');

  function apply(theme) {
    html.setAttribute('data-theme', theme);
    iconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function init() {
    const saved = storage.get(STORAGE_KEY, 'light');
    apply(saved);

    toggleBtn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      storage.set(STORAGE_KEY, next);
    });
  }

  return { init };
})();

/* ── 3. Greeting & Clock ────────────────────────────────── */

const ClockModule = (() => {
  const dateTimeEl   = $('dateTime');
  const greetingEl   = $('greetingText');

  const GREETINGS = [
    { range: [5,  11], text: 'Good morning'   },
    { range: [12, 16], text: 'Good afternoon' },
    { range: [17, 20], text: 'Good evening'   },
    { range: [21, 23], text: 'Good night'     },
    { range: [0,   4], text: 'Good night'     },
  ];

  function getGreeting(hour) {
    for (const g of GREETINGS) {
      const [start, end] = g.range;
      if (hour >= start && hour <= end) return g.text;
    }
    return 'Hello';
  }

  function formatDate(now) {
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    });
  }

  function formatTime(now) {
    return now.toLocaleTimeString('en-US', {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function tick() {
    const now  = new Date();
    const hour = now.getHours();

    dateTimeEl.textContent = `${formatDate(now)} · ${formatTime(now)}`;

    // Update greeting text but preserve any custom name appended by NameModule
    const base = getGreeting(hour);
    greetingEl.dataset.base = base;   // store base so NameModule can append name
    NameModule.refreshGreeting();
  }

  function init() {
    tick();
    setInterval(tick, 1000);
  }

  return { init };
})();

/* ── 4. Custom Name ─────────────────────────────────────── */

const NameModule = (() => {
  const STORAGE_KEY  = 'fd_name';
  const displayEl    = $('displayName');
  const editBtn      = $('editNameBtn');
  const modal        = $('nameModal');
  const nameInput    = $('nameInput');
  const saveBtn      = $('saveNameBtn');
  const cancelBtn    = $('cancelNameBtn');
  const greetingEl   = $('greetingText');

  let currentName = '';

  function refreshGreeting() {
    const base = greetingEl.dataset.base || greetingEl.textContent.replace(/,.*/, '');
    if (currentName) {
      greetingEl.textContent = `${base}, ${currentName}!`;
      displayEl.textContent  = '';
      editBtn.textContent    = '✏️ Edit name';
    } else {
      greetingEl.textContent = `${base}!`;
      displayEl.textContent  = '';
      editBtn.textContent    = '✏️ Set name';
    }
  }

  function openModal() {
    nameInput.value = currentName;
    modal.classList.remove('hidden');
    nameInput.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  function saveName() {
    const val = nameInput.value.trim();
    currentName = val;
    storage.set(STORAGE_KEY, val);
    refreshGreeting();
    closeModal();
    showToast(val ? `Welcome, ${val}!` : 'Name cleared.');
  }

  function init() {
    currentName = storage.get(STORAGE_KEY, '');
    refreshGreeting();

    editBtn.addEventListener('click', openModal);
    saveBtn.addEventListener('click', saveName);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
  }

  return { init, refreshGreeting };
})();

/* ── 5. Focus Timer ─────────────────────────────────────── */

const TimerModule = (() => {
  const STORAGE_KEY  = 'fd_timer_minutes';
  const displayEl    = $('timerDisplay');
  const labelEl      = $('timerLabel');
  const minutesInput = $('timerMinutes');
  const startBtn     = $('timerStart');
  const stopBtn      = $('timerStop');
  const resetBtn     = $('timerReset');

  let totalSeconds  = 25 * 60;
  let remaining     = totalSeconds;
  let intervalId    = null;
  let isRunning     = false;

  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    displayEl.textContent = `${pad(m)}:${pad(s)}`;
    document.title = isRunning ? `${pad(m)}:${pad(s)} — Focus` : 'Focus Dashboard';
  }

  function setControls(running) {
    startBtn.disabled = running;
    stopBtn.disabled  = !running;
    displayEl.classList.toggle('running', running);
  }

  function finish() {
    clearInterval(intervalId);
    isRunning = false;
    remaining = 0;
    render();
    setControls(false);
    labelEl.textContent = '🎉 Session complete!';
    showToast('⏰ Timer done! Great focus session.');
    document.title = 'Focus Dashboard';
  }

  function start() {
    if (isRunning) return;

    // Apply custom minutes if user changed the input and timer hasn't started yet
    if (remaining === totalSeconds) {
      const mins = parseInt(minutesInput.value, 10);
      if (!isNaN(mins) && mins >= 1 && mins <= 99) {
        totalSeconds = mins * 60;
        remaining    = totalSeconds;
        storage.set(STORAGE_KEY, mins);
        render();
      }
    }

    isRunning = true;
    labelEl.textContent = 'Focus Session';
    setControls(true);

    intervalId = setInterval(() => {
      remaining--;
      render();
      if (remaining <= 0) finish();
    }, 1000);
  }

  function stop() {
    if (!isRunning) return;
    clearInterval(intervalId);
    isRunning = false;
    setControls(false);
    labelEl.textContent = 'Paused';
  }

  function reset() {
    clearInterval(intervalId);
    isRunning = false;
    const mins = parseInt(minutesInput.value, 10);
    const valid = !isNaN(mins) && mins >= 1 && mins <= 99;
    totalSeconds = (valid ? mins : 25) * 60;
    remaining    = totalSeconds;
    render();
    setControls(false);
    labelEl.textContent = 'Focus Session';
    document.title = 'Focus Dashboard';
  }

  function init() {
    const savedMins = storage.get(STORAGE_KEY, 25);
    minutesInput.value = savedMins;
    totalSeconds = savedMins * 60;
    remaining    = totalSeconds;
    render();

    startBtn.addEventListener('click', start);
    stopBtn.addEventListener('click',  stop);
    resetBtn.addEventListener('click', reset);

    minutesInput.addEventListener('change', () => {
      if (!isRunning) reset();
    });
  }

  return { init };
})();

/* ── 6. To-Do List ──────────────────────────────────────── */

const TodoModule = (() => {
  const STORAGE_KEY = 'fd_todos';
  const formEl      = $('todoForm');
  const inputEl     = $('todoInput');
  const listEl      = $('todoList');
  const emptyEl     = $('todoEmpty');
  const sortSelect  = $('sortSelect');
  const editModal   = $('editModal');
  const editInput   = $('editInput');
  const saveEditBtn = $('saveEditBtn');
  const cancelEditBtn = $('cancelEditBtn');

  let todos      = [];
  let editingId  = null;

  /* --- Persistence --- */
  function load()  { todos = storage.get(STORAGE_KEY, []); }
  function save()  { storage.set(STORAGE_KEY, todos); }

  /* --- Utilities --- */
  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  function normalize(str) { return str.trim().toLowerCase(); }

  function isDuplicate(text, excludeId = null) {
    return todos.some(
      (t) => t.id !== excludeId && normalize(t.text) === normalize(text)
    );
  }

  /* --- Sort --- */
  function getSorted() {
    const order = sortSelect.value;
    const copy  = [...todos];
    if (order === 'az')   return copy.sort((a, b) => a.text.localeCompare(b.text));
    if (order === 'za')   return copy.sort((a, b) => b.text.localeCompare(a.text));
    if (order === 'done') return copy.sort((a, b) => Number(a.done) - Number(b.done));
    return copy; // default insertion order
  }

  /* --- Render --- */
  function render() {
    listEl.innerHTML = '';
    const sorted = getSorted();

    emptyEl.style.display = sorted.length ? 'none' : 'block';

    sorted.forEach((todo) => {
      const li = document.createElement('li');
      li.className = `todo-item${todo.done ? ' done' : ''}`;
      li.dataset.id = todo.id;

      li.innerHTML = `
        <input
          type="checkbox"
          class="todo-checkbox"
          aria-label="Mark as done"
          ${todo.done ? 'checked' : ''}
        />
        <span class="task-text">${escapeHtml(todo.text)}</span>
        <div class="task-actions">
          <button class="btn btn-secondary btn-sm edit-btn" aria-label="Edit task">✏️</button>
          <button class="btn btn-danger btn-sm delete-btn" aria-label="Delete task">🗑</button>
        </div>
      `;

      listEl.appendChild(li);
    });
  }

  /* --- CRUD --- */
  function addTodo(text) {
    if (!text) { showToast('Please enter a task.'); return; }
    if (isDuplicate(text)) {
      showToast('⚠️ That task already exists!');
      return;
    }
    todos.push({ id: genId(), text: text.trim(), done: false });
    save();
    render();
    inputEl.value = '';
    showToast('Task added!');
  }

  function toggleDone(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    save();
    render();
  }

  function openEdit(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    editingId          = id;
    editInput.value    = todo.text;
    editModal.classList.remove('hidden');
    editInput.focus();
    editInput.select();
  }

  function saveEdit() {
    const newText = editInput.value.trim();
    if (!newText) { showToast('Task cannot be empty.'); return; }
    if (isDuplicate(newText, editingId)) {
      showToast('⚠️ A task with that name already exists!');
      return;
    }
    const todo = todos.find((t) => t.id === editingId);
    if (todo) { todo.text = newText; save(); render(); }
    closeEdit();
    showToast('Task updated!');
  }

  function closeEdit() {
    editModal.classList.add('hidden');
    editingId = null;
  }

  function deleteTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    save();
    render();
    showToast('Task deleted.');
  }

  /* --- Event delegation for list --- */
  listEl.addEventListener('change', (e) => {
    if (e.target.classList.contains('todo-checkbox')) {
      const id = e.target.closest('.todo-item').dataset.id;
      toggleDone(id);
    }
  });

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const id = item.dataset.id;
    if (e.target.classList.contains('edit-btn'))   openEdit(id);
    if (e.target.classList.contains('delete-btn')) deleteTodo(id);
  });

  function init() {
    load();
    render();

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      addTodo(inputEl.value.trim());
    });

    sortSelect.addEventListener('change', render);

    saveEditBtn.addEventListener('click',   saveEdit);
    cancelEditBtn.addEventListener('click', closeEdit);
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEdit(); });
    editInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEdit(); });
  }

  return { init };
})();

/* ── 7. Quick Links ─────────────────────────────────────── */

const LinksModule = (() => {
  const STORAGE_KEY = 'fd_links';
  const formEl      = $('linkForm');
  const nameInput   = $('linkName');
  const urlInput    = $('linkUrl');
  const listEl      = $('linkList');
  const emptyEl     = $('linksEmpty');

  let links = [];

  function load() { links = storage.get(STORAGE_KEY, []); }
  function save() { storage.set(STORAGE_KEY, links); }
  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  function normalizeUrl(url) {
    url = url.trim();
    if (url && !url.match(/^https?:\/\//i)) url = 'https://' + url;
    return url;
  }

  function render() {
    listEl.innerHTML = '';
    emptyEl.style.display = links.length ? 'none' : 'block';

    links.forEach((link) => {
      const chip = document.createElement('div');
      chip.className  = 'link-chip';
      chip.dataset.id = link.id;

      chip.innerHTML = `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(link.name)}
        </a>
        <button class="chip-delete" aria-label="Remove ${escapeHtml(link.name)}">✕</button>
      `;

      listEl.appendChild(chip);
    });
  }

  function addLink(name, url) {
    if (!name) { showToast('Please enter a label.'); return; }
    if (!url)  { showToast('Please enter a URL.');   return; }
    links.push({ id: genId(), name: name.trim(), url });
    save();
    render();
    nameInput.value = '';
    urlInput.value  = '';
    showToast('Link added!');
  }

  listEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-delete')) {
      const id = e.target.closest('.link-chip').dataset.id;
      links = links.filter((l) => l.id !== id);
      save();
      render();
      showToast('Link removed.');
    }
  });

  function init() {
    load();
    render();

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      addLink(nameInput.value.trim(), normalizeUrl(urlInput.value));
    });
  }

  return { init };
})();

/* ── 8. Toast Notifications ─────────────────────────────── */

let toastTimer = null;

function showToast(msg, duration = 2800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

/* ── Security helper ─────────────────────────────────────── */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── 9. Init ─────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  ThemeModule.init();
  ClockModule.init();
  NameModule.init();
  TimerModule.init();
  TodoModule.init();
  LinksModule.init();
});
