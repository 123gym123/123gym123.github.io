// Estado de la aplicación
const state = {
  user: null,
  tasks: [],
  objetivos: [],
  gym: {},
  gymWorkouts: [],
  notes: [],
  currentView: 'dashboard',
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  theme: localStorage.getItem('theme') || 'dark',
  timerRunning: false,
  timerSeconds: 1500,
  currentStreak: 0,
  currentWorkoutDay: null
};

const GYM_FOCUS = { pecho: 'Pecho', espalda: 'Espalda', piernas: 'Piernas', hombros: 'Hombros', brazos: 'Brazos', core: 'Core', full: 'Full body', cardio: 'Cardio', otro: 'Otro' };
const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABELS = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };
const CATEGORIAS = { trabajo: 'Trabajo', personal: 'Personal', estudio: 'Estudio', salud: 'Salud', otros: 'Otros' };
const PRIORIDADES = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PIN_CORRECTO = '1971';

// DOM
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const logoutBtn = document.getElementById('logout-btn');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const cancelTaskBtn = document.getElementById('cancel-task-btn');
const pageTitle = document.getElementById('page-title');

// Helpers
function formatDate(d) { return d.toISOString().slice(0, 10); }
function today() { return formatDate(new Date()); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function getWeekDates(startOnMonday = true) {
  const now = new Date();
  const day = now.getDay();
  const diff = startOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function dateToDayKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return days[d.getDay()];
}

// === TEMA ===
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// === NOTIFICACIONES ===
function showNotification(message, type = 'info', duration = 3000) {
  const container = document.getElementById('notifications-container');
  const notif = document.createElement('div');
  notif.className = `notification notification-${type}`;
  notif.textContent = message;
  notif.style.animation = 'slideInRight 0.3s ease';
  container.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

// === BÚSQUEDA ===
function handleSearch(query) {
  if (!query.trim()) {
    switchView(state.currentView);
    return;
  }
  
  const results = state.tasks.filter(t => 
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase())
  );
  
  const container = document.getElementById('lista-tareas');
  container.innerHTML = results.length === 0 
    ? '<div class="day-empty">No hay resultados</div>' 
    : results.map(t => taskItemHtml(t.date, t)).join('');
  bindTaskListeners(container);
}

// === MIGRACION ===
function migrateTasks() {
  const key = 'tasks_app';
  const old = localStorage.getItem(key);
  if (!old) return;
  try {
    const parsed = JSON.parse(old);
    if (Array.isArray(parsed)) return;
    if (typeof parsed === 'object') {
      const week = getWeekDates();
      const migrated = [];
      Object.keys(parsed).forEach(day => {
        const tasks = parsed[day] || [];
        const dayIndex = DAYS.indexOf(day);
        if (dayIndex >= 0 && week[dayIndex]) {
          const dateStr = formatDate(week[dayIndex]);
          tasks.forEach(t => {
            migrated.push({
              id: t.id || generateId(),
              name: t.name,
              time: t.time || '09:00',
              date: dateStr,
              category: t.category || '',
              priority: t.priority || 'media',
              description: t.description || '',
              completed: !!t.completed,
              estimado: t.estimado || 0,
              recordatorio: !!t.recordatorio
            });
          });
        }
      });
      state.tasks = migrated;
      saveToStorage();
    }
  } catch (e) {}
}

// === INICIO ===
function init() {
  loadFromStorage();
  migrateTasks();
  setTheme(state.theme);

  if (state.user) showApp();
  else showLogin();

  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  addTaskBtn.addEventListener('click', () => openTaskModal());
  cancelTaskBtn.addEventListener('click', closeTaskModal);
  taskForm.addEventListener('submit', handleTaskSubmit);
  taskModal.addEventListener('click', e => { if (e.target === taskModal) closeTaskModal(); });

  document.getElementById('search-tasks').addEventListener('input', e => handleSearch(e.target.value));

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('cal-prev').addEventListener('click', () => { state.calMonth--; renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { state.calMonth++; renderCalendar(); });
  document.getElementById('cal-today').addEventListener('click', () => {
    const now = new Date();
    state.calMonth = now.getMonth();
    state.calYear = now.getFullYear();
    renderCalendar();
  });

  document.getElementById('add-objetivo-btn').addEventListener('click', () => openObjetivoModal());
  document.getElementById('cancel-objetivo-btn').addEventListener('click', () => closeObjetivoModal());
  document.getElementById('objetivo-form').addEventListener('submit', handleObjetivoSubmit);
  document.getElementById('objetivo-modal').addEventListener('click', e => { if (e.target.id === 'objetivo-modal') closeObjetivoModal(); });


  document.getElementById('add-gym-btn').addEventListener('click', () => openGymModal());
  document.getElementById('cancel-gym-btn').addEventListener('click', () => closeGymModal());
  document.getElementById('gym-form').addEventListener('submit', handleGymSubmit);
  document.getElementById('gym-modal').addEventListener('click', e => { if (e.target.id === 'gym-modal') closeGymModal(); });
  document.getElementById('gym-workout-modal').addEventListener('click', e => { if (e.target.id === 'gym-workout-modal') closeWorkoutModal(); });
  document.getElementById('gym-history-modal').addEventListener('click', e => { if (e.target.id === 'gym-history-modal') closeGymHistoryModal(); });

  // Configuración
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', importData);
  document.getElementById('clear-data-btn').addEventListener('click', clearAllData);

  // Timer
  document.getElementById('timer-start').addEventListener('click', startTimer);
  document.getElementById('timer-pause').addEventListener('click', pauseTimer);
  document.getElementById('timer-reset').addEventListener('click', resetTimer);
  document.getElementById('timer-close').addEventListener('click', () => document.getElementById('timer-modal').classList.remove('active'));

  // Notas
  document.getElementById('notes-form').addEventListener('submit', e => { e.preventDefault(); addNote(); });
  document.getElementById('notes-close').addEventListener('click', () => document.getElementById('notes-modal').classList.remove('active'));

  // GYM mejorado
  document.getElementById('gym-history-btn').addEventListener('click', openGymHistoryModal);
  document.getElementById('close-gym-history').addEventListener('click', closeGymHistoryModal);
  document.getElementById('cancel-workout-btn').addEventListener('click', closeWorkoutModal);
  document.getElementById('gym-workout-form').addEventListener('submit', handleWorkoutSubmit);
}

// === LOGIN ===
function handleLogin(e) {
  e.preventDefault();
  if (passwordInput.value !== PIN_CORRECTO) {
    showNotification('Contraseña incorrecta', 'error');
    passwordInput.value = '';
    return;
  }
  state.user = { authenticated: true };
  saveToStorage();
  showApp();
  loginForm.reset();
  showNotification('¡Bienvenido!', 'success');
}

function handleLogout() { 
  state.user = null; 
  saveToStorage(); 
  showLogin();
  showNotification('Sesión cerrada', 'info');
}

function showLogin() { loginScreen.classList.add('active'); appScreen.classList.remove('active'); }
function showApp() {
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
  setTaskDateDefault();
  switchView(state.currentView);
}

// === STORAGE ===
function getTasksKey() { return state.user ? 'tasks_app' : null; }

function loadFromStorage() {
  try {
    const u = localStorage.getItem('currentUser');
    if (u) { const p = JSON.parse(u); if (p && p.authenticated) state.user = p; }
    const key = getTasksKey();
    if (key) {
      const t = localStorage.getItem(key);
      if (t) state.tasks = JSON.parse(t);
      if (!Array.isArray(state.tasks)) state.tasks = [];

      const o = localStorage.getItem(key + '_objetivos');
      if (o) { state.objetivos = JSON.parse(o); if (!Array.isArray(state.objetivos)) state.objetivos = []; }

      const g = localStorage.getItem(key + '_gym');
      if (g) { state.gym = JSON.parse(g); if (typeof state.gym !== 'object') state.gym = {}; }

      const gw = localStorage.getItem(key + '_gymWorkouts');
      if (gw) { state.gymWorkouts = JSON.parse(gw); if (!Array.isArray(state.gymWorkouts)) state.gymWorkouts = []; }

      const n = localStorage.getItem(key + '_notes');
      if (n) { state.notes = JSON.parse(n); if (!Array.isArray(state.notes)) state.notes = []; }
    }
  } catch (e) {}
}

function saveToStorage() {
  try {
    if (state.user) localStorage.setItem('currentUser', JSON.stringify(state.user));
    else localStorage.removeItem('currentUser');
    const key = getTasksKey();
    if (key) {
      localStorage.setItem(key, JSON.stringify(state.tasks));
      localStorage.setItem(key + '_objetivos', JSON.stringify(state.objetivos));
      localStorage.setItem(key + '_gym', JSON.stringify(state.gym));
      localStorage.setItem(key + '_gymWorkouts', JSON.stringify(state.gymWorkouts));
      localStorage.setItem(key + '_notes', JSON.stringify(state.notes));
    }
  } catch (e) {}
}

// === EXPORTAR/IMPORTAR ===
function exportData() {
  const data = {
    tasks: state.tasks,
    objetivos: state.objetivos,
    gym: state.gym,
    gymWorkouts: state.gymWorkouts,
    notes: state.notes,
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('Datos exportados correctamente', 'success');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    try {
      const imported = JSON.parse(event.target.result);
      state.tasks = imported.tasks || [];
      state.objetivos = imported.objetivos || [];
      state.gym = imported.gym || {};
      state.gymWorkouts = imported.gymWorkouts || [];
      state.notes = imported.notes || [];
      saveToStorage();
      refreshCurrentView();
      showNotification('Datos importados correctamente', 'success');
    } catch (err) {
      showNotification('Error al importar datos', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function clearAllData() {
  if (!confirm('¿Estás seguro? Esta acción es irreversible.')) return;
  state.tasks = [];
  state.objetivos = [];
  state.gym = {};
  state.gymWorkouts = [];
  state.notes = [];
  saveToStorage();
  refreshCurrentView();
  showNotification('Todos los datos han sido eliminados', 'warning');
}

// === TAREAS ===
function getTasksByDate(dateStr) {
  return state.tasks.filter(t => t.date === dateStr);
}

function getTasksForDayOfWeek(dayKey, weekDates) {
  const idx = DAYS.indexOf(dayKey);
  if (idx < 0) return [];
  const dateStr = formatDate(weekDates[idx]);
  return getTasksByDate(dateStr);
}

function getAllTasks() { return [...state.tasks].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); }

function addTask(data) {
  state.tasks.push({
    id: generateId(),
    name: data.name,
    time: data.time || '09:00',
    date: data.date,
    category: data.category || '',
    priority: data.priority || 'media',
    description: data.description || '',
    completed: false,
    estimado: data.estimado || 0,
    recordatorio: data.recordatorio || false
  });
  saveToStorage();
  showNotification('Tarea añadida', 'success');
}

function updateTask(id, data) {
  const t = state.tasks.find(x => x.id === id);
  if (t) {
    t.name = data.name;
    t.time = data.time;
    t.date = data.date;
    t.category = data.category || '';
    t.priority = data.priority || 'media';
    t.description = data.description || '';
    t.estimado = data.estimado || 0;
    t.recordatorio = data.recordatorio || false;
    saveToStorage();
    showNotification('Tarea actualizada', 'success');
  }
}

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) { 
    t.completed = !t.completed; 
    saveToStorage(); 
    refreshCurrentView();
    calculateStreak();
    if (t.completed) showNotification('¡Tarea completada! 🎉', 'success');
  }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveToStorage();
  refreshCurrentView();
  showNotification('Tarea eliminada', 'info');
}

// === NOTAS RÁPIDAS ===
function addNote() {
  const text = document.getElementById('note-text').value.trim();
  if (!text) return;
  
  state.notes.push({
    id: generateId(),
    text: text,
    date: today(),
    time: new Date().toLocaleTimeString()
  });
  
  saveToStorage();
  document.getElementById('notes-form').reset();
  renderNotes();
  showNotification('Nota añadida', 'success');
}

function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  saveToStorage();
  renderNotes();
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  if (state.notes.length === 0) {
    list.innerHTML = '<p class="day-empty">No hay notas aún</p>';
    return;
  }
  
  list.innerHTML = state.notes.map(n => `
    <div class="note-item">
      <div class="note-content">${escapeHtml(n.text)}</div>
      <div class="note-meta">${n.date} ${n.time}</div>
      <button class="task-delete" onclick="deleteNote('${n.id}')">×</button>
    </div>
  `).join('');
}

// === TIMER POMODORO ===
let timerInterval = null;

function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  document.getElementById('timer-start').style.display = 'none';
  document.getElementById('timer-pause').style.display = 'block';
  
  timerInterval = setInterval(() => {
    if (state.timerSeconds > 0) {
      state.timerSeconds--;
      updateTimerDisplay();
    } else {
      pauseTimer();
      showNotification('¡Tiempo de descanso! 🎉', 'success');
    }
  }, 1000);
}

function pauseTimer() {
  state.timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timer-start').style.display = 'block';
  document.getElementById('timer-pause').style.display = 'none';
}

function resetTimer() {
  pauseTimer();
  state.timerSeconds = 1500;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timerSeconds / 60);
  const secs = state.timerSeconds % 60;
  document.getElementById('timer-display').textContent = 
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// === ESTADÍSTICAS ===
function calculateStreak() {
  let streak = 0;
  const dates = [...new Set(state.tasks.map(t => t.date))].sort().reverse();
  
  for (let date of dates) {
    const tasks = getTasksByDate(date);
    if (tasks.length > 0 && tasks.every(t => t.completed)) {
      streak++;
    } else {
      break;
    }
  }
  
  state.currentStreak = streak;
  return streak;
}

function renderAnalisis() {
  calculateStreak();
  
  // Datos para gráficas
  const weekDates = getWeekDates();
  const weekLabels = weekDates.map(d => d.getDate());
  const weekCompletedData = weekDates.map(d => {
    const tasks = getTasksByDate(formatDate(d));
    return tasks.filter(t => t.completed).length;
  });
  
  const categoryData = {};
  Object.keys(CATEGORIAS).forEach(cat => {
    categoryData[CATEGORIAS[cat]] = state.tasks.filter(t => t.category === cat).length;
  });
  
  const priorityData = {};
  Object.keys(PRIORIDADES).forEach(pri => {
    priorityData[PRIORIDADES[pri]] = state.tasks.filter(t => t.priority === pri).length;
  });
  
  // Gráfica de productividad semanal
  const ctxWeekly = document.getElementById('chart-weekly');
  if (ctxWeekly && typeof Chart !== 'undefined') {
    new Chart(ctxWeekly, {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: [{
          label: 'Tareas Completadas',
          data: weekCompletedData,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }
  
  // Gráfica por categoría
  const ctxCategory = document.getElementById('chart-category');
  if (ctxCategory && typeof Chart !== 'undefined') {
    new Chart(ctxCategory, {
      type: 'doughnut',
      data: {
        labels: Object.keys(categoryData),
        datasets: [{
          data: Object.values(categoryData),
          backgroundColor: ['#3b82f6', '#eab308', '#10b981', '#ef4444', '#8b5cf6']
        }]
      },
      options: { responsive: true }
    });
  }
  
  // Gráfica por prioridad
  const ctxPriority = document.getElementById('chart-priority');
  if (ctxPriority && typeof Chart !== 'undefined') {
    new Chart(ctxPriority, {
      type: 'pie',
      data: {
        labels: Object.keys(priorityData),
        datasets: [{
          data: Object.values(priorityData),
          backgroundColor: ['#ef4444', '#eab308', '#22c55e']
        }]
      },
      options: { responsive: true }
    });
  }
  
  // Estadísticas de progreso
  const total = state.tasks.length;
  const completadas = state.tasks.filter(t => t.completed).length;
  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
  
  document.getElementById('progress-rate').style.width = porcentaje + '%';
  document.getElementById('progress-rate-text').textContent = porcentaje + '%';
  document.getElementById('current-streak').textContent = state.currentStreak;
}

// === VISTAS ===
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  semana: 'Semana',
  calendario: 'Calendario',
  objetivos: 'Objetivos',
  gym: 'GYM',
  analisis: 'Análisis',
  config: 'Configuración'
};

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => { n.classList.toggle('active', n.dataset.view === view); });
  pageTitle.textContent = VIEW_TITLES[view];
  document.getElementById('search-tasks').value = '';

  const headerActions = document.querySelector('.header-actions');
  if (headerActions) {
    const addTaskBtn = document.getElementById('add-task-btn');
    addTaskBtn.style.display = ['dashboard','semana','calendario'].includes(view) ? '' : 'none';
  }

  if (view === 'dashboard') renderDashboard();
  else if (view === 'semana') renderSemana();
  else if (view === 'calendario') renderCalendar();
  else if (view === 'objetivos') renderObjetivos();
  else if (view === 'gym') renderGym();
  else if (view === 'analisis') renderAnalisis();
}

function refreshCurrentView() {
  switchView(state.currentView);
}

// === DASHBOARD ===
function renderDashboard() {
  const hoy = today();
  const tasksHoy = getTasksByDate(hoy);
  const completadasHoy = tasksHoy.filter(t => t.completed).length;
  const weekDates = getWeekDates();

  // Calcular progreso semanal
  let totalTasksWeek = 0;
  let completedTasksWeek = 0;
  weekDates.forEach(d => {
    const ts = getTasksByDate(formatDate(d));
    totalTasksWeek += ts.length;
    completedTasksWeek += ts.filter(t => t.completed).length;
  });
  const progresoSemanal = totalTasksWeek > 0 ? Math.round((completedTasksWeek / totalTasksWeek) * 100) : 0;

  // Calcular racha
  calculateStreak();

  // Calcular tiempo estimado pendiente
  const pendientes = state.tasks.filter(t => !t.completed);
  const tiempoEstimado = pendientes.reduce((sum, t) => sum + (t.estimado || 0), 0);
  const tiempoHoras = (tiempoEstimado / 60).toFixed(1);

  // Calcular tareas atrasadas
  const atrasadas = state.tasks.filter(t => !t.completed && t.date < hoy).length;

  document.getElementById('stat-hoy').textContent = tasksHoy.length;
  document.getElementById('stat-completadas').textContent = completadasHoy;
  document.getElementById('stat-racha').textContent = state.currentStreak;
  document.getElementById('stat-progreso-semana').textContent = progresoSemanal + '%';
  document.getElementById('stat-tiempo-estimado').textContent = tiempoHoras + 'h';
  document.getElementById('stat-atrasadas').textContent = atrasadas;

  // Preparar objetivos para mostrar
  const objetivosPendientes = state.objetivos.filter(o => !o.completed && o.fechaLimite);
  const objetivosOrdenados = objetivosPendientes.sort((a, b) => {
    return new Date(a.fechaLimite) - new Date(b.fechaLimite);
  }).slice(0, 3);

  const proximas = getAllTasks().filter(t => !t.completed).slice(0, 5);
  const proximasEl = document.getElementById('dashboard-proximas');
  proximasEl.innerHTML = proximas.length === 0
    ? '<div class="day-empty">No hay tareas pendientes</div>'
    : proximas.map(t => taskItemHtml(t.date, t)).join('');
  bindTaskListeners(proximasEl);

  const objetivosEl = document.getElementById('dashboard-objetivos');
  if (objetivosOrdenados.length === 0) {
    objetivosEl.innerHTML = '<div class="day-empty">No hay objetivos con fecha límite</div>';
  } else {
    objetivosEl.innerHTML = objetivosOrdenados.map(obj => {
      const diasRestantes = Math.ceil((new Date(obj.fechaLimite + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / (1000 * 60 * 60 * 24));
      let claseUrgencia = '';
      let textoTiempo = '';
      if (diasRestantes < 0) {
        claseUrgencia = 'vencido';
        textoTiempo = `Vencido hace ${Math.abs(diasRestantes)}d`;
      } else if (diasRestantes === 0) {
        claseUrgencia = 'hoy';
        textoTiempo = 'Vence hoy';
      } else if (diasRestantes <= 7) {
        claseUrgencia = 'urgente';
        textoTiempo = `${diasRestantes}d restantes`;
      } else {
        textoTiempo = `${diasRestantes}d restantes`;
      }
      return `<div class="objetivo-mini-item ${claseUrgencia}">
        <span class="objetivo-mini-text">${escapeHtml(obj.text)}</span>
        <span class="objetivo-mini-tiempo">${textoTiempo}</span>
      </div>`;
    }).join('');
  }

  const resumenEl = document.getElementById('dashboard-resumen');
  resumenEl.innerHTML = weekDates.map((d, i) => {
    const dateStr = formatDate(d);
    const ts = getTasksByDate(dateStr);
    const done = ts.length > 0 && ts.every(t => t.completed);
    return `<div class="week-mini-day ${done ? 'completed' : ''}">
      <span class="day-name">${DAY_LABELS[DAYS[i]]}</span>
      <span class="day-count">${ts.length}</span>
    </div>`;
  }).join('');
}

// === SEMANA ===
function renderSemana() {
  const weekDates = getWeekDates();
  const container = document.querySelector('#view-semana .week-container');
  container.innerHTML = '';

  DAYS.forEach((dayKey, idx) => {
    const d = weekDates[idx];
    const dateStr = formatDate(d);
    const tasks = getTasksByDate(dateStr).sort((a, b) => a.time.localeCompare(b.time));
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const isComplete = total > 0 && completed === total;
    const dateLabel = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const totalTime = tasks.reduce((sum, t) => sum + (t.estimado || 0), 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Determinar carga de trabajo
    let workloadClass = '';
    let workloadLabel = '';
    if (total >= 6) { workloadClass = 'heavy'; workloadLabel = 'Carga alta'; }
    else if (total >= 3) { workloadClass = 'medium'; workloadLabel = 'Carga media'; }
    else if (total > 0) { workloadClass = 'light'; workloadLabel = 'Carga ligera'; }

    const card = document.createElement('div');
    card.className = `day-card ${isComplete ? 'completed' : ''}`;
    card.dataset.date = dateStr;
    card.innerHTML = `
      <div class="day-header-wrap">
        <div class="day-header">
          <span class="day-name">${DAY_LABELS[dayKey]}</span>
          <span class="day-date">${dateLabel}</span>
          ${workloadLabel ? `<span class="day-workload-badge ${workloadClass}">${workloadLabel}</span>` : ''}
          <span class="day-status ${isComplete ? 'completed-badge' : ''}">${isComplete ? '✓ Día cumplido' : total > 0 ? completed + '/' + total + ' tareas' : 'Sin tareas'}</span>
          ${totalTime > 0 ? `<span class="day-time-estimate">⏱️ ${totalTime} min estimados</span>` : ''}
        </div>
        ${total > 0 ? `
        <div class="day-progress">
          <div class="day-progress-bar">
            <div class="day-progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="day-progress-text">${progress}% completado</span>
        </div>` : ''}
      </div>
      <div class="day-tasks">
        ${tasks.length === 0 ? '<div class="day-empty">Sin tareas programadas para este día</div>' : tasks.map(t => taskItemHtml(dateStr, t)).join('')}
        <div class="day-quick-add" data-date="${dateStr}">+ Añadir tarea rápida</div>
      </div>
    `;
    container.appendChild(card);
    bindTaskListeners(card);
  });

  // Bind evento para añadir tareas rápidas
  document.querySelectorAll('.day-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dateStr = btn.dataset.date;
      document.getElementById('task-date').value = dateStr;
      openTaskModal();
    });
  });
}

function taskItemHtml(dateStr, task) {
  const prior = task.priority ? `<span class="task-priority ${task.priority}">${PRIORIDADES[task.priority] || ''}</span>` : '';
  const reminder = task.recordatorio ? '🔔 ' : '';
  return `
    <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}" data-date="${dateStr}">
      <div class="task-check">${task.completed ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div class="task-content">
        <div class="task-name">${reminder}${escapeHtml(task.name)}${prior}</div>
        <div class="task-time">⏱ ${task.time}${task.category ? ' · ' + (CATEGORIAS[task.category] || task.category) : ''}${task.estimado ? ' · ' + task.estimado + 'min' : ''}</div>
      </div>
      <button class="task-delete" data-id="${task.id}" title="Eliminar">×</button>
    </div>`;
}

function bindTaskListeners(container) {
  if (!container) return;
  container.querySelectorAll('.task-check').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); toggleTask(btn.closest('.task-item').dataset.id); };
  });
  container.querySelectorAll('.task-item').forEach(item => {
    item.onclick = e => {
      if (e.target.closest('.task-delete')) return;
      if (e.target.closest('.task-check')) return;
      toggleTask(item.dataset.id);
    };
    item.ondblclick = e => {
      if (e.target.closest('.task-delete')) return;
      const task = state.tasks.find(t => t.id === item.dataset.id);
      if (task) openTaskModal(task);
    };
  });
  container.querySelectorAll('.task-delete').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteTask(btn.dataset.id); };
  });
}

// === CALENDARIO ===
function renderCalendar() {
  const m = state.calMonth;
  const y = state.calYear;
  const date = new Date(y, m, 1);
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('cal-month-year').textContent = `${monthNames[m]} ${y}`;

  if (m < 0) { state.calMonth = 11; state.calYear--; renderCalendar(); return; }
  if (m > 11) { state.calMonth = 0; state.calYear++; renderCalendar(); return; }

  const firstDay = date.getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();

  let html = '<div class="cal-day-header">Lun</div><div class="cal-day-header">Mar</div><div class="cal-day-header">Mié</div><div class="cal-day-header">Jue</div><div class="cal-day-header">Vie</div><div class="cal-day-header">Sáb</div><div class="cal-day-header">Dom</div>';

  for (let i = 0; i < startOffset; i++) {
    const dayNum = prevMonthDays - startOffset + i + 1;
    const prevDate = new Date(y, m - 1, dayNum);
    const dateStr = formatDate(prevDate);
    const tasks = getTasksByDate(dateStr);
    const dayCompleted = tasks.length > 0 && tasks.every(t => t.completed);
    html += `<div class="cal-day other-month ${dayCompleted ? 'day-completed' : ''}" data-date="${dateStr}">${buildCalDayContent(dayNum, tasks)}</div>`;
  }

  const todayStr = today();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(new Date(y, m, d));
    const tasks = getTasksByDate(dateStr);
    const hasTasks = tasks.length > 0;
    const isToday = dateStr === todayStr;
    const dayCompleted = tasks.length > 0 && tasks.every(t => t.completed);
    html += `<div class="cal-day ${isToday ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''} ${dayCompleted ? 'day-completed' : ''}" data-date="${dateStr}">${buildCalDayContent(d, tasks)}</div>`;
  }

  const totalCells = startOffset + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    const d = i + 1;
    const nextDate = new Date(y, m + 1, d);
    const dateStr = formatDate(nextDate);
    const tasks = getTasksByDate(dateStr);
    const dayCompleted = tasks.length > 0 && tasks.every(t => t.completed);
    html += `<div class="cal-day other-month ${dayCompleted ? 'day-completed' : ''}" data-date="${dateStr}">${buildCalDayContent(d, tasks)}</div>`;
  }

  document.getElementById('calendar-grid').innerHTML = html;

  document.querySelectorAll('#calendar-grid .cal-day').forEach(el => {
    el.addEventListener('click', () => showCalendarDayTasks(el.dataset.date));
  });

  const sel = document.querySelector('.cal-day[data-date="' + todayStr + '"]');
  if (sel) showCalendarDayTasks(todayStr);
  else document.getElementById('calendar-day-tasks').innerHTML = '<p class="day-empty">Selecciona un día</p>';
}

function buildCalDayContent(dayNum, tasks) {
  const priorityBadges = tasks.slice(0, 5).map(t => `<span class="cal-badge ${t.priority || 'media'}"></span>`).join('');
  const tooltip = tasks.length > 0 ? `<div class="cal-day-tooltip">${tasks.slice(0, 3).map(t => `<div class="tooltip-task">${escapeHtml(t.name)}</div>`).join('')}${tasks.length > 3 ? `<div class="tooltip-task">+${tasks.length - 3} más...</div>` : ''}</div>` : '';
  const taskCountDisplay = tasks.length > 0 ? `<span class="day-task-count-mobile">${tasks.length}</span>` : '';
  return `<div class="cal-day-inner"><span class="day-num">${dayNum}</span>${taskCountDisplay}</div><div class="cal-day-badges">${priorityBadges}</div>${tooltip}`;
}

function showCalendarDayTasks(dateStr) {
  const tasks = getTasksByDate(dateStr).sort((a, b) => a.time.localeCompare(b.time));
  const d = new Date(dateStr + 'T12:00:00');
  const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const html = `<h4>${label}</h4>${tasks.length === 0 ? '<p class="day-empty">Sin tareas</p>' : tasks.map(t => taskItemHtml(dateStr, t)).join('')}`;
  document.getElementById('calendar-day-tasks').innerHTML = html;
  bindTaskListeners(document.getElementById('calendar-day-tasks'));
}

// === OBJETIVOS ===
function renderObjetivos() {
  const container = document.getElementById('objetivos-list');
  const list = state.objetivos;
  if (list.length === 0) {
    container.innerHTML = '<div class="day-empty">Añade tus objetivos y márcalos cuando los cumplas</div>';
    return;
  }

  const hoy = today();
  container.innerHTML = list.map(obj => {
    let fechaInfo = '';
    if (obj.fechaLimite) {
      const diasRestantes = Math.ceil((new Date(obj.fechaLimite + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) {
        fechaInfo = `<span class="objetivo-fecha vencido">Vencido hace ${Math.abs(diasRestantes)} días</span>`;
      } else if (diasRestantes === 0) {
        fechaInfo = `<span class="objetivo-fecha hoy">Vence hoy</span>`;
      } else if (diasRestantes <= 7) {
        fechaInfo = `<span class="objetivo-fecha urgente">Quedan ${diasRestantes} días</span>`;
      } else {
        fechaInfo = `<span class="objetivo-fecha">${diasRestantes} días restantes</span>`;
      }
    }
    return `
    <div class="objetivo-item ${obj.completed ? 'completed' : ''}" data-id="${obj.id}">
      <div class="task-check">${obj.completed ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div class="objetivo-content">
        <div class="objetivo-text">${escapeHtml(obj.text)}</div>
        ${fechaInfo}
      </div>
      <button class="task-delete" data-id="${obj.id}" title="Eliminar">×</button>
    </div>
  `;
  }).join('');
  container.querySelectorAll('.task-check').forEach(btn => {
    btn.onclick = () => toggleObjetivo(btn.closest('.objetivo-item').dataset.id);
  });
  container.querySelectorAll('.objetivo-item').forEach(item => {
    item.onclick = e => { if (!e.target.closest('.task-delete')) toggleObjetivo(item.dataset.id); };
  });
  container.querySelectorAll('.task-delete').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteObjetivo(btn.dataset.id); };
  });
}

function addObjetivo(text, fechaLimite = null) {
  state.objetivos.push({
    id: generateId(),
    text: text.trim(),
    completed: false,
    fechaLimite: fechaLimite || null
  });
  saveToStorage();
  showNotification('Objetivo añadido', 'success');
}

function toggleObjetivo(id) {
  const o = state.objetivos.find(x => x.id === id);
  if (o) { o.completed = !o.completed; saveToStorage(); renderObjetivos(); }
}

function deleteObjetivo(id) {
  state.objetivos = state.objetivos.filter(o => o.id !== id);
  saveToStorage();
  renderObjetivos();
}

function openObjetivoModal() {
  document.getElementById('objetivo-modal').classList.add('active');
  document.getElementById('objetivo-text').value = '';
  document.getElementById('objetivo-fecha').value = '';
  document.getElementById('objetivo-text').focus();
}

function closeObjetivoModal() {
  document.getElementById('objetivo-modal').classList.remove('active');
  document.getElementById('objetivo-form').reset();
}

function handleObjetivoSubmit(e) {
  e.preventDefault();
  const text = document.getElementById('objetivo-text').value.trim();
  const fecha = document.getElementById('objetivo-fecha').value || null;
  if (!text) return;
  addObjetivo(text, fecha);
  closeObjetivoModal();
  renderObjetivos();
}

// === GYM ===
function renderGym() {
  const container = document.getElementById('gym-container');
  const routines = state.gym;
  const daysWithRoutine = Object.keys(routines);

  // Calcular estadísticas de la semana
  const weekDates = getWeekDates();
  const thisWeekWorkouts = state.gymWorkouts.filter(w => {
    const wDate = new Date(w.date);
    return wDate >= weekDates[0] && wDate <= weekDates[6];
  });
  const weekWorkoutCount = thisWeekWorkouts.length;
  const weekVolume = thisWeekWorkouts.reduce((sum, w) => {
    return sum + (w.exercises || []).reduce((exSum, ex) => {
      return exSum + (ex.sets || []).reduce((setSum, set) => setSum + (set.weight * set.reps || 0), 0);
    }, 0);
  }, 0);
  const weekGroups = [...new Set(thisWeekWorkouts.map(w => w.focus).filter(Boolean))].join(', ') || '-';

  document.getElementById('gym-week-workouts').textContent = weekWorkoutCount;
  document.getElementById('gym-week-volume').textContent = Math.round(weekVolume);
  document.getElementById('gym-week-groups').textContent = weekGroups;

  if (daysWithRoutine.length === 0) {
    container.innerHTML = '<div class="day-empty">Añade tus rutinas de gym por día de la semana</div>';
    return;
  }

  container.innerHTML = DAYS.map(dayKey => {
    const r = routines[dayKey];
    if (!r) return '';
    const exercises = (r.exercises || '').split('\n').filter(l => l.trim());
    const todayWorkout = thisWeekWorkouts.find(w => w.day === dayKey);
    const hasWorkout = !!todayWorkout;

    return `
      <div class="gym-day-card" data-day="${dayKey}">
        <div class="gym-day-header">
          <span class="day-name">${DAY_LABELS[dayKey]}</span>
          <span class="gym-focus-badge">${GYM_FOCUS[r.focus] || r.focus}</span>
          ${hasWorkout ? '<span class="workout-status completed">✓ Completado esta semana</span>' : ''}
          <button class="task-delete gym-delete-btn" data-day="${dayKey}" title="Eliminar">×</button>
        </div>
        <ul class="gym-exercises-list">${exercises.map(ex => `<li>${escapeHtml(ex.trim())}</li>`).join('')}</ul>
        <button class="btn-start-workout" data-day="${dayKey}">💪 Registrar entrenamiento</button>
      </div>
    `;
  }).filter(Boolean).join('');

  container.querySelectorAll('.gym-day-card').forEach(card => {
    card.onclick = e => {
      if (e.target.closest('.gym-delete-btn')) return;
      if (e.target.closest('.btn-start-workout')) return;
      openGymModal(card.dataset.day);
    };
  });

  container.querySelectorAll('.gym-delete-btn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteGymRoutine(btn.dataset.day); };
  });

  container.querySelectorAll('.btn-start-workout').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); openWorkoutModal(btn.dataset.day); };
  });
}

function addGymRoutine(day, focus, exercises) {
  state.gym[day] = { focus, exercises: exercises.trim() };
  saveToStorage();
  showNotification('Rutina de gym añadida', 'success');
}

function deleteGymRoutine(day) {
  delete state.gym[day];
  saveToStorage();
  renderGym();
}

function openGymModal(editDay = null) {
  document.getElementById('gym-modal').classList.add('active');
  if (editDay) {
    const r = state.gym[editDay];
    document.getElementById('gym-day').value = editDay;
    document.getElementById('gym-focus').value = r?.focus || 'pecho';
    document.getElementById('gym-exercises').value = r?.exercises || '';
  } else {
    document.getElementById('gym-form').reset();
    document.getElementById('gym-day').value = 'lunes';
    document.getElementById('gym-focus').value = 'pecho';
  }
}

function closeGymModal() {
  document.getElementById('gym-modal').classList.remove('active');
  document.getElementById('gym-form').reset();
}

function handleGymSubmit(e) {
  e.preventDefault();
  const day = document.getElementById('gym-day').value;
  const focus = document.getElementById('gym-focus').value;
  const exercises = document.getElementById('gym-exercises').value;
  addGymRoutine(day, focus, exercises);
  closeGymModal();
  renderGym();
}

// === LISTA ===
function renderLista() {
  const cat = document.getElementById('filter-categoria').value;
  const prio = document.getElementById('filter-prioridad').value;
  const estado = document.getElementById('filter-estado').value;
  const fecha = document.getElementById('filter-fecha').value;

  let list = getAllTasks();
  if (cat) list = list.filter(t => t.category === cat);
  if (prio) list = list.filter(t => t.priority === prio);
  if (estado === 'pendientes') list = list.filter(t => !t.completed);
  else if (estado === 'completadas') list = list.filter(t => t.completed);
  if (fecha) list = list.filter(t => t.date === fecha);

  const container = document.getElementById('lista-tareas');
  container.innerHTML = list.length === 0 ? '<div class="day-empty">No hay tareas</div>' : list.map(t => taskItemHtml(t.date, t)).join('');
  bindTaskListeners(container);
}

// === MODAL TAREA ===
function setTaskDateDefault() {
  const el = document.getElementById('task-date');
  if (el && !el.value) el.value = today();
}

function openTaskModal(editTask = null) {
  setTaskDateDefault();
  taskModal.classList.add('active');
  if (editTask) {
    document.getElementById('task-name').value = editTask.name;
    document.getElementById('task-date').value = editTask.date;
    document.getElementById('task-time').value = editTask.time;
    document.getElementById('task-categoria').value = editTask.category || '';
    document.getElementById('task-prioridad').value = editTask.priority || 'media';
    document.getElementById('task-descripcion').value = editTask.description || '';
    document.getElementById('task-estimado').value = editTask.estimado || '';
    document.getElementById('task-recordatorio').checked = editTask.recordatorio || false;
    taskForm.dataset.editId = editTask.id;
  } else {
    taskForm.reset();
    setTaskDateDefault();
    delete taskForm.dataset.editId;
  }
  document.getElementById('task-name').focus();
}

function closeTaskModal() {
  taskModal.classList.remove('active');
  taskForm.reset();
  delete taskForm.dataset.editId;
}

function handleTaskSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('task-name').value.trim();
  const date = document.getElementById('task-date').value;
  const time = document.getElementById('task-time').value;
  const category = document.getElementById('task-categoria').value;
  const priority = document.getElementById('task-prioridad').value;
  const description = document.getElementById('task-descripcion').value.trim();
  const estimado = parseInt(document.getElementById('task-estimado').value) || 0;
  const recordatorio = document.getElementById('task-recordatorio').checked;

  if (!name || !date) return;

  const data = { name, date, time, category, priority, description, estimado, recordatorio };

  if (taskForm.dataset.editId) {
    updateTask(taskForm.dataset.editId, data);
  } else {
    addTask(data);
  }

  closeTaskModal();
  refreshCurrentView();
}

// === GYM WORKOUT ===
function openWorkoutModal(day) {
  state.currentWorkoutDay = day;
  const routine = state.gym[day];
  if (!routine) return;

  document.getElementById('gym-workout-modal').classList.add('active');
  document.getElementById('workout-day').value = day;

  const exercises = (routine.exercises || '').split('\n').filter(l => l.trim());
  const container = document.getElementById('workout-exercises-list');

  container.innerHTML = exercises.map((ex, idx) => {
    const [name, sets] = ex.split(/\s+(?=\d+x)/);
    const [numSets] = sets ? sets.split('x') : ['3'];
    const setsCount = parseInt(numSets) || 3;

    return `
      <div class="workout-exercise-item">
        <h4>${escapeHtml(name.trim())}</h4>
        <div class="workout-sets">
          ${Array(setsCount).fill(0).map((_, setIdx) => `
            <div class="workout-set-row">
              <label>Serie ${setIdx + 1}</label>
              <input type="number" placeholder="Reps" data-ex="${idx}" data-set="${setIdx}" data-field="reps" min="1" value="10">
              <input type="number" placeholder="Peso (kg)" data-ex="${idx}" data-set="${setIdx}" data-field="weight" min="0" step="0.5" value="0">
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function closeWorkoutModal() {
  document.getElementById('gym-workout-modal').classList.remove('active');
  document.getElementById('gym-workout-form').reset();
}

function handleWorkoutSubmit(e) {
  e.preventDefault();
  const day = document.getElementById('workout-day').value;
  const notes = document.getElementById('workout-notes').value.trim();
  const routine = state.gym[day];

  if (!routine) return;

  const exercises = (routine.exercises || '').split('\n').filter(l => l.trim());
  const workoutData = {
    id: generateId(),
    day: day,
    focus: routine.focus,
    date: today(),
    exercises: exercises.map((ex, idx) => {
      const [name] = ex.split(/\s+(?=\d+x)/);
      const sets = [];
      document.querySelectorAll(`[data-ex="${idx}"]`).forEach(input => {
        const setIdx = parseInt(input.dataset.set);
        const field = input.dataset.field;
        if (!sets[setIdx]) sets[setIdx] = {};
        sets[setIdx][field] = parseFloat(input.value) || 0;
      });
      return { name: name.trim(), sets };
    }),
    notes
  };

  state.gymWorkouts.push(workoutData);
  saveToStorage();
  closeWorkoutModal();
  renderGym();
  showNotification('¡Entrenamiento registrado! 💪', 'success');
}

function openGymHistoryModal() {
  document.getElementById('gym-history-modal').classList.add('active');
  renderGymHistory();
}

function closeGymHistoryModal() {
  document.getElementById('gym-history-modal').classList.remove('active');
}

function renderGymHistory() {
  const list = document.getElementById('gym-history-list');
  if (state.gymWorkouts.length === 0) {
    list.innerHTML = '<p class="day-empty">No hay entrenamientos registrados</p>';
    return;
  }

  const sorted = [...state.gymWorkouts].sort((a, b) => b.date.localeCompare(a.date));

  list.innerHTML = sorted.map(w => {
    const dateObj = new Date(w.date + 'T12:00:00');
    const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return `
      <div class="gym-history-item">
        <h4>${GYM_FOCUS[w.focus] || w.focus} - ${DAY_LABELS[w.day] || w.day}</h4>
        <div class="history-date">${dateLabel}</div>
        <div class="history-exercises">
          ${w.exercises.map(ex => {
            const setsInfo = ex.sets.map(s => `${s.reps}x${s.weight}kg`).join(', ');
            return `<div>${escapeHtml(ex.name)}: ${setsInfo}</div>`;
          }).join('')}
        </div>
        ${w.notes ? `<div class="history-notes">${escapeHtml(w.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

init();
