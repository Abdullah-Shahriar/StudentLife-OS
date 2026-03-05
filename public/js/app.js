/* ================================================
   StudentLife OS – app.js
   Master dashboard controller
   ================================================ */

// ── AUTH GLOBALS ──
const TOKEN = localStorage.getItem('sl_token');
const USER = JSON.parse(localStorage.getItem('sl_user') || 'null');
const SESSION_ID = localStorage.getItem('sl_session');

if (!TOKEN || !USER) { window.location.href = '/'; }

// ── API HELPER ──
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  logTool(path);
  return data;
}

// ── LOG TOOL USAGE ──
function logTool(path) {
  if (SESSION_ID) {
    fetch('/api/auth/log-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ sessionId: SESSION_ID, tool: path })
    }).catch(() => {});
  }
}

// ── TOAST ──
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.onclick = () => el.remove();
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── MODAL HELPERS ──
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.add('hidden');
});

// ── SIDEBAR / NAVIGATION ──
let currentPage = 'overview';
function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) {
    page.classList.add('active');
    currentPage = name;
  }
  if (btn) btn.classList.add('active');

  const titles = {
    overview: 'Overview', todo: 'Todo List', planner: 'Day Planner',
    courses: 'My Courses', grades: 'Grades & Stats', calendar: 'Academic Calendar',
    reminders: 'Reminders', bot: 'AI Assistant', profile: 'My Profile'
  };
  document.getElementById('pageTitle').textContent = titles[name] || name;

  // Refresh data when switching pages
  switch (name) {
    case 'overview': loadOverview(); break;
    case 'todo': loadTodos(); break;
    case 'planner': loadPlanner(); break;
    case 'courses': loadCourses(); break;
    case 'grades': loadGrades(); break;
    case 'calendar': renderCalendar(); break;
    case 'reminders': loadReminders(); break;
    case 'bot': initBot(); break;
    case 'profile': loadProfile(); break;
  }

  // Close mobile sidebar
  closeSidebar();
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('mobileOverlay');
  s.classList.toggle('open');
  o.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('mobileOverlay')?.classList.remove('show');
}

// Show mobile menu btn on small screens
function checkMobile() {
  const btn = document.getElementById('menuBtn');
  if (btn) btn.style.display = window.innerWidth < 768 ? 'flex' : 'none';
}
window.addEventListener('resize', checkMobile);
checkMobile();

// ── INIT ──
function init() {
  // Set user info
  if (USER) {
    const initial = USER.name ? USER.name[0].toUpperCase() : '?';
    ['userAvatarSidebar', 'userAvatarTop', 'profileAvatar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = initial;
    });
    const nameEl = document.getElementById('userNameSidebar');
    const emailEl = document.getElementById('userEmailSidebar');
    if (nameEl) nameEl.textContent = USER.name;
    if (emailEl) emailEl.textContent = USER.email;

    const greetName = document.getElementById('greetingName');
    if (greetName) greetName.textContent = USER.name.split(' ')[0];
  }

  // Date
  const now = new Date();
  const h = now.getHours();
  const gtime = document.getElementById('greetingTime');
  if (gtime) gtime.textContent = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const topDate = document.getElementById('topDate');
  if (topDate) topDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  loadOverview();
  checkUpcomingReminders();
  setInterval(checkUpcomingReminders, 60000);
}

// ── LOGOUT ──
async function logout() {
  try {
    await api('POST', '/auth/logout', { sessionId: SESSION_ID });
  } catch {}
  localStorage.clear();
  window.location.href = '/';
}

// ── STATE ──
let allTodos = [];
let academicData = { courses: [], calendar: [] };
let allReminders = [];
let plannerDate = new Date().toISOString().split('T')[0];
let calendarDate = new Date();
let courseDetailChartInst = null;

// ════════════════════════════════════════
// O V E R V I E W
// ════════════════════════════════════════
let overviewChartInst = null;

async function loadOverview() {
  try {
    const [todos, academic, reminders] = await Promise.all([
      api('GET', '/todo'),
      api('GET', '/academic'),
      api('GET', '/reminders/upcoming')
    ]);

    allTodos = todos;
    academicData = academic;
    allReminders = reminders;

    const today = new Date().toISOString().split('T')[0];
    const todayTodos = todos.filter(t => t.date === today);
    const doneTodos = todayTodos.filter(t => t.completed);

    setEl('ovTodayTasks', todayTodos.length);
    setEl('ovDoneTasks', doneTodos.length);
    setEl('ovCourses', academic.courses.length);
    setEl('ovReminders', reminders.length);

    // Overall average
    let totalPct = 0, cnt = 0;
    academic.courses.forEach(c => {
      (c.assessments || []).forEach(a => { totalPct += parseFloat(a.percentage); cnt++; });
    });
    const avg = cnt ? (totalPct / cnt).toFixed(1) + '%' : '—';
    setEl('ovAvg', avg);

    // Badge counts
    const pendingCount = todos.filter(t => !t.completed && t.date === today).length;
    setEl('todoBadge', pendingCount);
    setEl('reminderBadge', reminders.length);

    // Todo mini list
    const ovList = document.getElementById('ovTodoList');
    if (ovList) {
      if (todayTodos.length === 0) {
        ovList.innerHTML = `<div style="text-align:center;color:var(--text-faint);padding:20px;font-size:13px;">No tasks for today. Great job! 🎉</div>`;
      } else {
        ovList.innerHTML = todayTodos.slice(0, 6).map(t => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
            <div onclick="toggleTodo('${t.id}')" style="cursor:pointer;width:16px;height:16px;border-radius:4px;border:2px solid ${t.completed ? 'var(--success)' : 'rgba(255,255,255,0.2)'};background:${t.completed ? 'var(--success)' : 'transparent'};display:flex;align-items:center;justify-content:center;font-size:10px;color:white;flex-shrink:0;">${t.completed ? '✓' : ''}</div>
            <span style="font-size:13px;${t.completed ? 'text-decoration:line-through;color:var(--text-faint)' : ''};flex:1;">${t.text}</span>
            <span class="priority-badge priority-${t.priority}">${t.priority}</span>
          </div>`).join('');
      }
    }

    // Reminders mini list
    const ovRemList = document.getElementById('ovRemindersList');
    if (ovRemList) {
      if (reminders.length === 0) {
        ovRemList.innerHTML = `<div style="color:var(--text-faint);font-size:13px;padding:12px 0;">No upcoming reminders in the next 7 days.</div>`;
      } else {
        ovRemList.innerHTML = reminders.slice(0, 4).map(r => {
          const d = new Date(r.datetime);
          const typeColors = { exam:'var(--danger)', assignment:'var(--warning)', class:'var(--secondary)', meeting:'var(--primary)', custom:'var(--text-muted)' };
          return `
          <div class="reminder-item">
            <div class="reminder-time-badge">
              <div class="rtime">${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
              <div class="rdate">${d.toLocaleDateString([],{month:'short',day:'2-digit'})}</div>
            </div>
            <div class="reminder-info">
              <div class="reminder-title">${r.title}</div>
              <div class="reminder-type" style="color:${typeColors[r.type]||'var(--text-muted)'}">● ${r.type}</div>
            </div>
          </div>`;
        }).join('');
      }
    }

    // Overview chart
    renderOverviewChart(academic);

  } catch (err) { console.error('Overview load error:', err); }
}

function renderOverviewChart(academic) {
  const ctx = document.getElementById('overviewChart');
  if (!ctx) return;
  if (overviewChartInst) overviewChartInst.destroy();

  const labels = [];
  const datasets = [];
  const colors = ['#6366f1','#06b6d4','#f472b6','#10b981','#f59e0b','#a855f7'];

  academic.courses.forEach((c, i) => {
    const sorted = [...(c.assessments || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(a => { if (!labels.includes(a.date)) labels.push(a.date); });
    if (sorted.length) {
      datasets.push({
        label: c.code || c.name,
        data: labels.map(l => { const a = sorted.find(x => x.date === l); return a ? parseFloat(a.percentage) : null; }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: false,
        spanGaps: true
      });
    }
  });

  labels.sort();

  overviewChartInst = new Chart(ctx, {
    type: 'line',
    data: { labels: labels.map(l => new Date(l).toLocaleDateString('en-US',{month:'short',day:'numeric'})), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { min: 0, max: 100, ticks: { color: '#64748b', font: { size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// ════════════════════════════════════════
// T O D O   L I S T
// ════════════════════════════════════════
let todoFilter = 'all';
let editingTodoId = null;

async function loadTodos() {
  try {
    allTodos = await api('GET', '/todo');
    renderTodos();
  } catch (err) { toast('Failed to load todos', 'error'); }
}

function renderTodos() {
  const list = document.getElementById('todoList');
  if (!list) return;

  let filtered = [...allTodos];
  const today = new Date().toISOString().split('T')[0];
  const dateFilter = document.getElementById('todoDateFilter')?.value;

  if (todoFilter === 'today') filtered = filtered.filter(t => t.date === today);
  else if (todoFilter === 'pending') filtered = filtered.filter(t => !t.completed);
  else if (todoFilter === 'completed') filtered = filtered.filter(t => t.completed);
  else if (todoFilter === 'high') filtered = filtered.filter(t => t.priority === 'high' && !t.completed);
  else if (todoFilter === 'date' && dateFilter) filtered = filtered.filter(t => t.date === dateFilter);

  filtered.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (p[a.priority] || 1) - (p[b.priority] || 1);
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-faint);padding:50px;font-size:14px;">
      ${todoFilter === 'completed' ? '✅ No completed tasks yet.' : '📋 No tasks found. Add one!'}
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(t => `
    <div class="todo-item ${t.completed ? 'completed' : ''}" id="todo-${t.id}">
      <div class="todo-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTodo('${t.id}')">${t.completed ? '✓' : ''}</div>
      <div class="todo-text">${escHtml(t.text)}</div>
      <div class="todo-meta">
        <span style="font-size:11px;color:var(--text-faint);">${formatDate(t.date)}</span>
        <span class="priority-badge priority-${t.priority}">${t.priority}</span>
        <span style="font-size:11px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:50px;padding:2px 8px;color:var(--text-muted);">${t.category}</span>
      </div>
      <div class="todo-actions">
        <button class="icon-btn" onclick="editTodo('${t.id}')" title="Edit">✏</button>
        <button class="icon-btn delete" onclick="deleteTodo('${t.id}')" title="Delete">🗑</button>
      </div>
    </div>`).join('');

  const pendingToday = allTodos.filter(t => !t.completed && t.date === new Date().toISOString().split('T')[0]).length;
  setEl('todoBadge', pendingToday);
}

function filterTodos(filter, btn) {
  todoFilter = filter;
  document.querySelectorAll('.todo-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTodos();
}

function openTodoModal(id = null) {
  editingTodoId = id;
  document.getElementById('todoModalTitle').textContent = id ? 'Edit Task' : 'Add Task';
  if (id) {
    const t = allTodos.find(x => x.id === id);
    if (t) {
      document.getElementById('todoText').value = t.text;
      document.getElementById('todoDate').value = t.date;
      document.getElementById('todoPriority').value = t.priority;
      document.getElementById('todoCategory').value = t.category;
    }
  } else {
    document.getElementById('todoText').value = '';
    document.getElementById('todoDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('todoPriority').value = 'medium';
    document.getElementById('todoCategory').value = 'general';
  }
  openModal('todoModal');
  setTimeout(() => document.getElementById('todoText')?.focus(), 100);
}

async function saveTodo() {
  const text = document.getElementById('todoText').value.trim();
  if (!text) { toast('Task text is required', 'error'); return; }
  const payload = {
    text,
    date: document.getElementById('todoDate').value,
    priority: document.getElementById('todoPriority').value,
    category: document.getElementById('todoCategory').value
  };
  try {
    if (editingTodoId) {
      await api('PUT', `/todo/${editingTodoId}`, payload);
      toast('Task updated', 'success');
    } else {
      await api('POST', '/todo', payload);
      toast('Task added', 'success');
    }
    closeModal('todoModal');
    loadTodos();
  } catch (err) { toast(err.message, 'error'); }
}

async function toggleTodo(id) {
  const t = allTodos.find(x => x.id === id);
  if (!t) return;
  try {
    await api('PUT', `/todo/${id}`, { completed: !t.completed });
    t.completed = !t.completed;
    renderTodos();
    if (currentPage === 'overview') loadOverview();
  } catch (err) { toast('Failed to update', 'error'); }
}

function editTodo(id) { openTodoModal(id); }

async function deleteTodo(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api('DELETE', `/todo/${id}`);
    toast('Task deleted', 'info');
    loadTodos();
  } catch (err) { toast('Failed to delete', 'error'); }
}

// ════════════════════════════════════════
// D A Y   P L A N N E R
// ════════════════════════════════════════
let plannerData = { tasks: [], note: '' };

async function loadPlanner() {
  renderPlannerDate();
  try {
    plannerData = await api('GET', `/todo/dayplan/${plannerDate}`);
    renderPlanner();
  } catch (err) { plannerData = { tasks: [], note: '' }; renderPlanner(); }
}

function renderPlannerDate() {
  const d = new Date(plannerDate + 'T00:00:00');
  const today = new Date().toISOString().split('T')[0];
  const isToday = plannerDate === today;
  const label = isToday ? `Today – ${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}` :
    d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  setEl('plannerDateDisplay', label);
  setEl('plannerHeading', isToday ? "Today's Plan" : label);
}

function renderPlanner() {
  const tasks = plannerData.tasks || [];
  const done = tasks.filter(t => t.done).length;
  const note = document.getElementById('plannerNote');
  if (note) note.value = plannerData.note || '';

  setEl('plannerProgress', `${done} / ${tasks.length} tasks done`);
  const bar = document.getElementById('plannerProgressBar');
  if (bar) bar.style.width = tasks.length ? (done / tasks.length * 100) + '%' : '0%';

  const list = document.getElementById('plannerTaskList');
  if (!list) return;
  if (tasks.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:var(--text-faint);padding:20px;font-size:13px;">No tasks for this day. Add one below!</div>`;
    return;
  }
  list.innerHTML = tasks.map((t, i) => `
    <div class="planner-task-item ${t.done ? 'done' : ''}" id="ptask-${i}">
      <div class="ptask-check ${t.done ? 'done' : ''}" onclick="togglePlannerTask(${i})">${t.done ? '✓' : ''}</div>
      <span class="ptask-text">${escHtml(t.text)}</span>
      <button class="icon-btn delete" onclick="deletePlannerTask(${i})">🗑</button>
    </div>`).join('');
}

function changePlannerDate(delta) {
  const d = new Date(plannerDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  plannerDate = d.toISOString().split('T')[0];
  loadPlanner();
}

function goToPlannerToday() {
  plannerDate = new Date().toISOString().split('T')[0];
  loadPlanner();
}

async function addPlannerTask() {
  const input = document.getElementById('plannerTaskInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  plannerData.tasks = plannerData.tasks || [];
  plannerData.tasks.push({ text, done: false });
  input.value = '';
  await savePlannerData();
  renderPlanner();
}

async function togglePlannerTask(idx) {
  if (!plannerData.tasks[idx]) return;
  plannerData.tasks[idx].done = !plannerData.tasks[idx].done;
  await savePlannerData();
  renderPlanner();
}

async function deletePlannerTask(idx) {
  plannerData.tasks.splice(idx, 1);
  await savePlannerData();
  renderPlanner();
}

async function savePlannerNote() {
  const note = document.getElementById('plannerNote')?.value || '';
  plannerData.note = note;
  await savePlannerData();
}

async function savePlannerData() {
  try { await api('POST', `/todo/dayplan/${plannerDate}`, plannerData); }
  catch (err) { toast('Failed to save', 'error'); }
}

// ════════════════════════════════════════
// C O U R S E S
// ════════════════════════════════════════
const COURSE_COLORS = ['#6366f1','#06b6d4','#f472b6','#10b981','#f59e0b','#a855f7','#ef4444','#14b8a6'];
let editingCourseId = null;
let viewingCourseId = null;

async function loadCourses() {
  try {
    academicData = await api('GET', '/academic');
    renderCourses();
  } catch (err) { toast('Failed to load courses', 'error'); }
}

function renderCourses() {
  const grid = document.getElementById('coursesGrid');
  if (!grid) return;

  if (academicData.courses.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);padding:60px;font-size:14px;">
      📚 No courses yet. Click "+ Add Course" to get started!
    </div>`;
    return;
  }

  grid.innerHTML = academicData.courses.map((c, i) => {
    const color = COURSE_COLORS[i % COURSE_COLORS.length];
    const assessments = c.assessments || [];
    const avg = assessments.length ?
      (assessments.reduce((s, a) => s + parseFloat(a.percentage), 0) / assessments.length).toFixed(1) : null;
    const lastAssess = assessments.length ? assessments[assessments.length - 1] : null;
    const prevAssess = assessments.length > 1 ? assessments[assessments.length - 2] : null;
    let trendIcon = '—';
    if (lastAssess && prevAssess) {
      trendIcon = parseFloat(lastAssess.percentage) >= parseFloat(prevAssess.percentage) ? '📈' : '📉';
    }

    return `
    <div class="course-card" style="--course-color:${color};">
      <div class="course-header">
        <span class="course-code" style="background:${color}20;color:${color};">${c.code || '?'}</span>
        <div style="display:flex;gap:6px;">
          <button class="icon-btn" onclick="editCourse('${c.id}')" title="Edit">✏</button>
          <button class="icon-btn delete" onclick="deleteCourse('${c.id}')" title="Delete">🗑</button>
        </div>
      </div>
      <div class="course-name">${escHtml(c.name)}</div>
      ${c.instructor ? `<div class="course-instructor">👨‍🏫 ${escHtml(c.instructor)}</div>` : ''}
      <div style="display:flex;align-items:baseline;gap:8px;margin:12px 0 4px;">
        <div class="course-avg" style="color:${avg ? scoreColor(parseFloat(avg)) : 'var(--text-faint)'}">${avg ? avg + '%' : '—'}</div>
        <span style="font-size:18px;">${trendIcon}</span>
      </div>
      <div class="mini-progress">
        <div class="mini-progress-fill" style="width:${avg || 0}%;background:${color};"></div>
      </div>
      <div class="course-assessments">${assessments.length} assessment${assessments.length !== 1 ? 's' : ''} • ${c.credits || 3} credits</div>
      <div class="course-actions">
        <button class="btn-secondary" style="flex:1;font-size:12px;padding:8px;" onclick="viewCourse('${c.id}')">📊 View Details</button>
        <button class="btn-primary" style="width:auto;flex:1;font-size:12px;padding:8px;" onclick="openAssessmentModal('${c.id}')">+ Score</button>
      </div>
    </div>`;
  }).join('');
}

function openCourseModal(id = null) {
  editingCourseId = id;
  document.getElementById('courseModalTitle').textContent = id ? 'Edit Course' : 'Add Course';
  if (id) {
    const c = academicData.courses.find(x => x.id === id);
    if (c) {
      document.getElementById('courseName').value = c.name;
      document.getElementById('courseCode').value = c.code || '';
      document.getElementById('courseInstructor').value = c.instructor || '';
      document.getElementById('courseCredits').value = c.credits || 3;
    }
  } else {
    ['courseName','courseCode','courseInstructor'].forEach(id => setInputVal(id, ''));
    setInputVal('courseCredits', '3');
  }
  openModal('courseModal');
}

async function saveCourse() {
  const name = document.getElementById('courseName').value.trim();
  if (!name) { toast('Course name is required', 'error'); return; }
  const payload = {
    name, code: document.getElementById('courseCode').value.trim(),
    instructor: document.getElementById('courseInstructor').value.trim(),
    credits: parseInt(document.getElementById('courseCredits').value) || 3
  };
  try {
    if (editingCourseId) {
      await api('PUT', `/academic/course/${editingCourseId}`, payload);
      toast('Course updated', 'success');
    } else {
      await api('POST', '/academic/course', payload);
      toast('Course added', 'success');
    }
    closeModal('courseModal');
    loadCourses();
  } catch (err) { toast(err.message, 'error'); }
}

function editCourse(id) { openCourseModal(id); }

async function deleteCourse(id) {
  const c = academicData.courses.find(x => x.id === id);
  if (!confirm(`Delete course "${c?.name}"? This will also remove all assessments.`)) return;
  try {
    await api('DELETE', `/academic/course/${id}`);
    toast('Course deleted', 'info');
    loadCourses();
  } catch (err) { toast(err.message, 'error'); }
}

function viewCourse(id) {
  viewingCourseId = id;
  const c = academicData.courses.find(x => x.id === id);
  if (!c) return;
  document.getElementById('courseDetailTitle').textContent = `${c.code} – ${c.name}`;
  renderCourseDetailChart(c);
  renderCourseDetailAssessments(c);
  openModal('courseDetailModal');
}

function renderCourseDetailChart(c) {
  const ctx = document.getElementById('courseDetailChart');
  if (!ctx) return;
  if (courseDetailChartInst) courseDetailChartInst.destroy();
  const sorted = [...(c.assessments || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const i = academicData.courses.findIndex(x => x.id === c.id);
  const color = COURSE_COLORS[i % COURSE_COLORS.length];

  courseDetailChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted.map(a => a.title),
      datasets: [{
        label: 'Score %',
        data: sorted.map(a => parseFloat(a.percentage)),
        borderColor: color, backgroundColor: color + '20',
        borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 7,
        tension: 0.4, fill: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { min: 0, max: 100, ticks: { color: '#64748b', font: { size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderCourseDetailAssessments(c) {
  const el = document.getElementById('courseDetailAssessments');
  if (!el) return;
  const sorted = [...(c.assessments || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!sorted.length) { el.innerHTML = `<p style="color:var(--text-faint);font-size:13px;">No assessments yet. Add one!</p>`; return; }

  el.innerHTML = sorted.map((a, idx) => {
    const prev = sorted[idx + 1];
    const pct = parseFloat(a.percentage);
    const prevPct = prev ? parseFloat(prev.percentage) : null;
    const trend = prevPct !== null ? (pct >= prevPct ? '📈 +' + (pct - prevPct).toFixed(1) + '%' : '📉 ' + (pct - prevPct).toFixed(1) + '%') : '';
    return `
    <div class="assessment-item">
      <span class="assess-type-badge type-${a.type}">${a.type}</span>
      <div class="assess-info">
        <div class="assess-title">${escHtml(a.title)}</div>
        <div class="assess-date">${formatDate(a.date)} ${trend ? `<span style="font-size:11px;">${trend}</span>` : ''}</div>
      </div>
      <div class="assess-score" style="color:${scoreColor(pct)}">${a.score}/${a.totalScore}</div>
      <div style="font-size:14px;font-weight:700;min-width:50px;text-align:right;color:${scoreColor(pct)}">${pct}%</div>
      <button class="icon-btn delete" onclick="deleteAssessment('${c.id}','${a.id}')">🗑</button>
    </div>`;
  }).join('');
}

function openAssessmentFromDetail() {
  if (viewingCourseId) openAssessmentModal(viewingCourseId);
}

function openAssessmentModal(courseId) {
  document.getElementById('assessCourseId').value = courseId;
  ['assessTitle','assessScore'].forEach(id => setInputVal(id, ''));
  setInputVal('assessTotal', '100');
  setInputVal('assessWeight', '100');
  setInputVal('assessDate', new Date().toISOString().split('T')[0]);
  document.getElementById('assessType').value = 'exam';
  openModal('assessmentModal');
}

async function saveAssessment() {
  const courseId = document.getElementById('assessCourseId').value;
  const score = document.getElementById('assessScore').value;
  const total = document.getElementById('assessTotal').value;
  const title = document.getElementById('assessTitle').value.trim();
  if (!title || score === '') { toast('Title and score are required', 'error'); return; }
  if (parseFloat(score) > parseFloat(total)) { toast('Score cannot exceed total marks', 'error'); return; }

  const payload = {
    type: document.getElementById('assessType').value,
    title, score: parseFloat(score),
    totalScore: parseFloat(total),
    date: document.getElementById('assessDate').value,
    weight: parseFloat(document.getElementById('assessWeight').value) || 100
  };

  try {
    await api('POST', `/academic/course/${courseId}/assessment`, payload);
    toast('Assessment saved! 🎯', 'success');
    closeModal('assessmentModal');
    academicData = await api('GET', '/academic');
    renderCourses();
    if (viewingCourseId === courseId) {
      const c = academicData.courses.find(x => x.id === courseId);
      if (c) { renderCourseDetailChart(c); renderCourseDetailAssessments(c); }
    }
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteAssessment(courseId, assessId) {
  if (!confirm('Delete this assessment?')) return;
  try {
    await api('DELETE', `/academic/course/${courseId}/assessment/${assessId}`);
    toast('Deleted', 'info');
    academicData = await api('GET', '/academic');
    const c = academicData.courses.find(x => x.id === courseId);
    if (c) { renderCourseDetailChart(c); renderCourseDetailAssessments(c); }
    renderCourses();
  } catch (err) { toast(err.message, 'error'); }
}

// ════════════════════════════════════════
// G R A D E S
// ════════════════════════════════════════
let overallTrendChartInst = null;
let gradeDonutInst = null;
const courseChartInsts = {};

async function loadGrades() {
  try {
    const stats = await api('GET', '/academic/stats');
    academicData = await api('GET', '/academic');
    renderGrades(stats);
  } catch (err) { toast('Failed to load grades', 'error'); }
}

function renderGrades(stats) {
  let totalPct = 0, cnt = 0, totalAssess = 0;
  stats.forEach(s => {
    s.assessments.forEach(a => { totalPct += parseFloat(a.percentage); cnt++; });
    totalAssess += s.assessments.length;
  });

  const avg = cnt ? (totalPct / cnt) : null;
  setEl('gradeOverallAvg', avg ? avg.toFixed(1) + '%' : '—');
  setEl('gradeLetterGrade', avg ? getLetterGrade(avg) : '—');
  setEl('gradeTotalAssess', totalAssess);

  // Update course filter
  const filter = document.getElementById('assessCourseFilter');
  if (filter) {
    const opts = ['<option value="all">All Courses</option>'];
    stats.forEach(s => opts.push(`<option value="${s.courseId}">${s.courseName}</option>`));
    filter.innerHTML = opts.join('');
  }

  // Donut chart
  renderDonutChart(stats);

  // Overall trend chart
  renderOverallTrendChart(stats);

  // Per-course charts
  renderCourseCharts(stats);

  // Assessments list
  renderAssessmentsTable(stats);
}

function renderDonutChart(stats) {
  const ctx = document.getElementById('gradeDonutChart');
  if (!ctx) return;
  if (gradeDonutInst) gradeDonutInst.destroy();

  if (!stats.some(s => s.assessments.length)) {
    gradeDonutInst = new Chart(ctx, { type: 'doughnut', data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.08)'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    return;
  }

  gradeDonutInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: stats.filter(s => s.assessments.length).map(s => s.code || s.courseName),
      datasets: [{
        data: stats.filter(s => s.assessments.length).map(s => s.average),
        backgroundColor: COURSE_COLORS.slice(0, stats.length),
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 }, position: 'right' } }
    }
  });
}

function renderOverallTrendChart(stats) {
  const ctx = document.getElementById('overallTrendChart');
  if (!ctx) return;
  if (overallTrendChartInst) overallTrendChartInst.destroy();

  const allDates = [];
  stats.forEach(s => s.assessments.forEach(a => { if (!allDates.includes(a.date)) allDates.push(a.date); }));
  allDates.sort();

  const datasets = stats.filter(s => s.assessments.length).map((s, i) => {
    const color = COURSE_COLORS[i % COURSE_COLORS.length];
    return {
      label: s.code || s.courseName,
      data: allDates.map(d => { const a = s.assessments.find(x => x.date === d); return a ? parseFloat(a.percentage) : null; }),
      borderColor: color, backgroundColor: color + '15',
      borderWidth: 2, pointRadius: 4, tension: 0.4, fill: false, spanGaps: true
    };
  });

  overallTrendChartInst = new Chart(ctx, {
    type: 'line',
    data: { labels: allDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { min: 0, max: 100, ticks: { color: '#64748b', callback: v => v + '%', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderCourseCharts(stats) {
  const grid = document.getElementById('courseChartsGrid');
  if (!grid) return;

  Object.values(courseChartInsts).forEach(inst => inst?.destroy());

  grid.innerHTML = stats.filter(s => s.assessments.length).map((s, i) => `
    <div class="chart-card">
      <h4 style="color:${COURSE_COLORS[i%COURSE_COLORS.length]}">📊 ${s.code || s.courseName} – ${s.courseName}</h4>
      <div style="font-size:20px;font-weight:700;color:${scoreColor(s.average)};margin:-8px 0 10px;">${s.average.toFixed(1)}% avg</div>
      <div class="chart-wrap"><canvas id="cc-${s.courseId}"></canvas></div>
    </div>`).join('');

  stats.filter(s => s.assessments.length).forEach((s, i) => {
    const ctx = document.getElementById(`cc-${s.courseId}`);
    if (!ctx) return;
    const color = COURSE_COLORS[i % COURSE_COLORS.length];
    courseChartInsts[s.courseId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: s.assessments.map(a => a.title.length > 12 ? a.title.slice(0, 12) + '…' : a.title),
        datasets: [{
          label: 'Score %',
          data: s.assessments.map(a => parseFloat(a.percentage)),
          backgroundColor: s.assessments.map((a, j) => {
            if (j === 0) return color + 'aa';
            return parseFloat(a.percentage) >= parseFloat(s.assessments[j - 1].percentage) ? '#10b98188' : '#ef444488';
          }),
          borderColor: color, borderWidth: 1.5, borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
          y: { min: 0, max: 100, ticks: { color: '#64748b', font: { size: 9 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  });
}

function renderAssessmentsTable(statsArg) {
  const el = document.getElementById('assessmentsList');
  if (!el) return;
  const filter = document.getElementById('assessCourseFilter')?.value || 'all';
  const stats = statsArg || window._lastStats || [];
  if (statsArg) window._lastStats = statsArg;

  let all = [];
  stats.forEach(s => {
    s.assessments.forEach(a => all.push({ ...a, courseName: s.courseName, courseId: s.courseId }));
  });
  if (filter !== 'all') all = all.filter(a => a.courseId === filter);
  all.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!all.length) { el.innerHTML = `<p style="color:var(--text-faint);font-size:13px;padding:20px 0;">No assessments found.</p>`; return; }

  el.innerHTML = all.map(a => {
    const pct = parseFloat(a.percentage);
    return `
    <div class="assessment-item">
      <span class="assess-type-badge type-${a.type}">${a.type}</span>
      <div class="assess-info">
        <div class="assess-title">${escHtml(a.title)}</div>
        <div class="assess-date" style="color:var(--text-faint);">${a.courseName} • ${formatDate(a.date)}</div>
      </div>
      <div class="assess-score" style="color:${scoreColor(pct)}">${a.score}/${a.totalScore}</div>
      <div style="font-size:16px;font-weight:700;min-width:55px;text-align:right;color:${scoreColor(pct)}">${pct}%</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════
// C A L E N D A R
// ════════════════════════════════════════
async function renderCalendar() {
  try {
    academicData = await api('GET', '/academic');
    drawCalendar();
    renderCalEventList();
    updateCalCourseSelect();
  } catch {}
}

function drawCalendar() {
  const grid = document.getElementById('calGrid');
  const label = document.getElementById('calMonthLabel');
  if (!grid || !label) return;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  label.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  let cells = [];

  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push(`<div class="cal-cell other-month"><div class="cal-num">${prevDays - i}</div></div>`);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const events = (academicData.calendar || []).filter(e => e.date === dateStr);
    const dots = events.slice(0, 3).map(e => {
      const colors = { exam:'var(--danger)', deadline:'var(--warning)', holiday:'var(--success)', event:'var(--primary)', class:'var(--secondary)' };
      return `<div class="cal-event-dot" style="background:${colors[e.type]||'var(--primary)'};" title="${e.title}"></div>`;
    }).join('');

    cells.push(`
      <div class="cal-cell ${isToday ? 'today' : ''}" onclick="openCalendarEventModal('${dateStr}')">
        <div class="cal-num">${d}</div>
        ${dots}
      </div>`);
  }

  // Remaining cells
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push(`<div class="cal-cell other-month"><div class="cal-num">${i}</div></div>`);
  }

  grid.innerHTML = cells.join('');
}

function renderCalEventList() {
  const el = document.getElementById('calEventList');
  if (!el) return;
  const now = new Date();
  const events = (academicData.calendar || [])
    .filter(e => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 10);

  if (!events.length) { el.innerHTML = `<p style="color:var(--text-faint);font-size:13px;padding:10px 0;">No upcoming events. Add some!</p>`; return; }

  const typeColors = { exam:'var(--danger)', deadline:'var(--warning)', holiday:'var(--success)', event:'var(--primary)', class:'var(--secondary)' };
  el.innerHTML = events.map(e => `
    <div class="reminder-item">
      <div class="reminder-time-badge">
        <div class="rtime">${String(new Date(e.date).getDate()).padStart(2,'0')}</div>
        <div class="rdate">${new Date(e.date).toLocaleDateString('en-US',{month:'short'})}</div>
      </div>
      <div class="reminder-info">
        <div class="reminder-title">${escHtml(e.title)}</div>
        <div class="reminder-type" style="color:${typeColors[e.type]||'var(--text-muted)'}">● ${e.type}${e.description ? ' – ' + escHtml(e.description) : ''}</div>
      </div>
      <button class="icon-btn delete" onclick="deleteCalEvent('${e.id}')">🗑</button>
    </div>`).join('');
}

function changeCalendarMonth(dir) {
  calendarDate.setMonth(calendarDate.getMonth() + dir);
  drawCalendar();
}
function goToCalendarToday() { calendarDate = new Date(); drawCalendar(); }

function updateCalCourseSelect() {
  const sel = document.getElementById('calEventCourse');
  if (!sel) return;
  sel.innerHTML = ['<option value="">No course</option>',
    ...(academicData.courses || []).map(c => `<option value="${c.id}">${c.code} – ${c.name}</option>`)
  ].join('');
}

function openCalendarEventModal(date) {
  document.getElementById('calEventDate').value = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
  ['calEventTitle', 'calEventDesc'].forEach(id => setInputVal(id, ''));
  document.getElementById('calEventType').value = 'event';
  updateCalCourseSelect();
  openModal('calEventModal');
}

async function saveCalendarEvent() {
  const title = document.getElementById('calEventTitle').value.trim();
  if (!title) { toast('Event title required', 'error'); return; }
  const payload = {
    title, date: document.getElementById('calEventDate').value,
    type: document.getElementById('calEventType').value,
    courseId: document.getElementById('calEventCourse').value || null,
    description: document.getElementById('calEventDesc').value.trim()
  };
  try {
    await api('POST', '/academic/calendar', payload);
    toast('Event added 📅', 'success');
    closeModal('calEventModal');
    academicData = await api('GET', '/academic');
    drawCalendar();
    renderCalEventList();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteCalEvent(id) {
  if (!confirm('Delete this event?')) return;
  try {
    await api('DELETE', `/academic/calendar/${id}`);
    toast('Deleted', 'info');
    academicData = await api('GET', '/academic');
    drawCalendar();
    renderCalEventList();
  } catch (err) { toast(err.message, 'error'); }
}

// ════════════════════════════════════════
// R E M I N D E R S
// ════════════════════════════════════════
let reminderFilter = 'upcoming';
let editingReminderId = null;

async function loadReminders() {
  try {
    allReminders = await api('GET', '/reminders');
    renderReminders();
  } catch (err) { toast('Failed to load reminders', 'error'); }
}

function renderReminders() {
  const el = document.getElementById('remindersList');
  if (!el) return;

  let items = [...allReminders];
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (reminderFilter === 'upcoming') {
    items = items.filter(r => !r.dismissed && new Date(r.datetime) >= now && new Date(r.datetime) <= week);
  } else if (reminderFilter !== 'all') {
    items = items.filter(r => r.type === reminderFilter);
  }

  items.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  const typeColors = { exam:'var(--danger)', assignment:'var(--warning)', class:'var(--secondary)', meeting:'var(--primary)', custom:'var(--text-muted)' };
  const typeIcons = { exam:'📋', assignment:'📝', class:'📚', meeting:'🤝', custom:'⭐' };

  if (!items.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--text-faint);padding:50px;font-size:14px;">
      ⏰ No ${reminderFilter === 'upcoming' ? 'upcoming' : ''} reminders found.
    </div>`;
    return;
  }

  el.innerHTML = items.map(r => {
    const d = new Date(r.datetime);
    const isPast = d < now;
    return `
    <div class="reminder-item ${r.dismissed ? 'dismissed' : ''}">
      <div class="reminder-time-badge" style="${isPast ? 'opacity:0.5;' : ''}">
        <div class="rtime">${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="rdate">${d.toLocaleDateString([],{month:'short',day:'2-digit'})}</div>
      </div>
      <div class="reminder-info">
        <div class="reminder-title">${typeIcons[r.type] || '⭐'} ${escHtml(r.title)}</div>
        <div class="reminder-type" style="color:${typeColors[r.type]||'var(--text-muted)'}">
          ${r.type}${r.note ? ' • ' + escHtml(r.note) : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${!r.dismissed ? `<button class="icon-btn" onclick="dismissReminder('${r.id}')" title="Dismiss">✓</button>` : ''}
        <button class="icon-btn delete" onclick="deleteReminder('${r.id}')" title="Delete">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function filterReminders(filter, btn) {
  reminderFilter = filter;
  document.querySelectorAll('.todo-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderReminders();
}

function openReminderModal(id = null) {
  editingReminderId = id;
  if (id) {
    const r = allReminders.find(x => x.id === id);
    if (r) {
      document.getElementById('reminderTitle').value = r.title;
      document.getElementById('reminderDatetime').value = r.datetime.slice(0, 16);
      document.getElementById('reminderType').value = r.type;
      document.getElementById('reminderNote').value = r.note || '';
    }
  } else {
    setInputVal('reminderTitle', '');
    setInputVal('reminderNote', '');
    const dt = new Date(); dt.setHours(dt.getHours() + 1, 0, 0, 0);
    setInputVal('reminderDatetime', dt.toISOString().slice(0, 16));
    document.getElementById('reminderType').value = 'exam';
  }
  openModal('reminderModal');
}

async function saveReminder() {
  const title = document.getElementById('reminderTitle').value.trim();
  const datetime = document.getElementById('reminderDatetime').value;
  if (!title || !datetime) { toast('Title and date are required', 'error'); return; }
  const payload = {
    title, datetime, type: document.getElementById('reminderType').value,
    note: document.getElementById('reminderNote').value.trim()
  };
  try {
    if (editingReminderId) {
      await api('PUT', `/reminders/${editingReminderId}`, payload);
      toast('Reminder updated', 'success');
    } else {
      await api('POST', '/reminders', payload);
      toast('Reminder set! ⏰', 'success');
    }
    closeModal('reminderModal');
    loadReminders();
  } catch (err) { toast(err.message, 'error'); }
}

async function dismissReminder(id) {
  try {
    await api('PUT', `/reminders/${id}`, { dismissed: true });
    toast('Reminder dismissed', 'info');
    loadReminders();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  try {
    await api('DELETE', `/reminders/${id}`);
    toast('Deleted', 'info');
    loadReminders();
  } catch (err) { toast(err.message, 'error'); }
}

async function checkUpcomingReminders() {
  try {
    const upcoming = await api('GET', '/reminders/upcoming');
    setEl('reminderBadge', upcoming.length);
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = upcoming.length ? 'block' : 'none';

    // Check if any reminder is within 30 minutes
    const now = new Date();
    upcoming.forEach(r => {
      const d = new Date(r.datetime);
      const diff = (d - now) / 60000;
      if (diff > 0 && diff <= 30) {
        toast(`⏰ Reminder in ${Math.ceil(diff)} min: ${r.title}`, 'warning');
      }
    });
  } catch {}
}

// ════════════════════════════════════════
// B O T   A S S I S T A N T
// ════════════════════════════════════════
let botInitialized = false;

function initBot() {
  if (botInitialized) return;
  botInitialized = true;
  addBotMessage(`Hello ${USER?.name?.split(' ')[0] || 'there'}! 👋 I'm StudyBot, your StudentLife OS assistant.\n\nI can help you with:\n• Your tasks and grades\n• Academic progress\n• Upcoming reminders\n• Motivation and study tips\n\nTry asking: "show my grades", "what tasks do I have today?", or "motivate me!" 💪`);
}

function addBotMessage(text) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <div class="msg-bubble">${escHtml(text)}</div>
      <div class="msg-time">${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const initial = USER?.name ? USER.name[0].toUpperCase() : '?';
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = `
    <div class="message-avatar">${initial}</div>
    <div class="message-content">
      <div class="msg-bubble">${escHtml(text)}</div>
      <div class="msg-time">${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = 'message bot';
  el.id = 'typingIndicator';
  el.innerHTML = `<div class="message-avatar">🤖</div><div class="msg-bubble chat-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgs?.appendChild(el);
  msgs && (msgs.scrollTop = msgs.scrollHeight);
}
function hideTyping() { document.getElementById('typingIndicator')?.remove(); }

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  input.style.height = '';

  addUserMessage(msg);
  showTyping();

  try {
    const data = await api('POST', '/bot/chat', { message: msg });
    hideTyping();
    addBotMessage(data.reply);
  } catch (err) {
    hideTyping();
    addBotMessage('Sorry, I had trouble processing that. Please try again!');
  }
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

function autoResizeChat(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ════════════════════════════════════════
// P R O F I L E
// ════════════════════════════════════════
async function loadProfile() {
  try {
    const profile = await api('GET', '/auth/profile');
    setEl('profileName', profile.name);
    setEl('profileEmail', profile.email);
    setEl('profilePhone', profile.phone || '—');
    setEl('profileJoined', new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    const a = document.getElementById('profileAvatar');
    if (a) a.textContent = profile.name?.[0]?.toUpperCase() || '?';
  } catch {}
}

// ════════════════════════════════════════
// U T I L I T I E S
// ════════════════════════════════════════
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setInputVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function scoreColor(pct) {
  if (pct >= 85) return 'var(--success)';
  if (pct >= 70) return 'var(--secondary)';
  if (pct >= 55) return 'var(--warning)';
  return 'var(--danger)';
}
function getLetterGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 85) return 'A';
  if (pct >= 80) return 'A-';
  if (pct >= 75) return 'B+';
  if (pct >= 70) return 'B';
  if (pct >= 65) return 'B-';
  if (pct >= 60) return 'C+';
  if (pct >= 55) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

// ── START ──
init();
