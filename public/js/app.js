/* ================================================
   StudentLife OS – app.js
   Master dashboard controller
   ================================================ */

// ── PREVENT COPY / SELECT / RIGHT-CLICK ──
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('copy',        e => e.preventDefault());
document.addEventListener('cut',         e => e.preventDefault());
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['c','x','a','u','s'].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key === 'F12') e.preventDefault();
});

// ── AUTH GLOBALS ──
const TOKEN = localStorage.getItem('sl_token');
const USER = JSON.parse(localStorage.getItem('sl_user') || 'null');
const SESSION_ID = localStorage.getItem('sl_session');

if (!TOKEN || !USER) { window.location.href = '/'; }

/* =================================================================
   GRADING SYSTEM (UIU — United International University)
   ================================================================= */
const GRADE_SCALE = [
  { letter: 'A',  gp: 4.00, min: 90, label: 'Outstanding'   },
  { letter: 'A-', gp: 3.67, min: 86, label: 'Excellent'     },
  { letter: 'B+', gp: 3.33, min: 82, label: 'Very Good'     },
  { letter: 'B',  gp: 3.00, min: 78, label: 'Good'          },
  { letter: 'B-', gp: 2.67, min: 74, label: 'Above Average' },
  { letter: 'C+', gp: 2.33, min: 70, label: 'Average'       },
  { letter: 'C',  gp: 2.00, min: 66, label: 'Below Average' },
  { letter: 'C-', gp: 1.67, min: 62, label: 'Poor'          },
  { letter: 'D+', gp: 1.33, min: 58, label: 'Very Poor'     },
  { letter: 'D',  gp: 1.00, min: 55, label: 'Pass'          },
  { letter: 'F',  gp: 0.00, min:  0, label: 'Fail'          },
];
function pctToGrade(pct)  { return GRADE_SCALE.find(g => pct >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1]; }
function calcCGPA(courses) {
  let tc = 0, tp = 0;
  (courses || []).forEach(c => {
    const a = c.assessments || [];
    if (!a.length) return;
    const avg = a.reduce((s, x) => s + parseFloat(x.percentage), 0) / a.length;
    const g   = pctToGrade(avg);
    const cr  = parseInt(c.credits) || 3;
    tc += cr; tp += cr * g.gp;
  });
  return tc > 0 ? parseFloat((tp / tc).toFixed(2)) : null;
}
function calcCourseGrade(course) {
  const a = course.assessments || [];
  if (!a.length) return null;
  const avg = a.reduce((s, x) => s + parseFloat(x.percentage), 0) / a.length;
  const g = pctToGrade(avg);
  return { pct: avg, ...g };
}

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

  // Semester progress ring animation
  (function animateSemesterRing() {
    const ring = document.getElementById('semesterRingFill');
    if (!ring) return;
    // Estimate semester Jan 6 – May 9 = 123 days; today = March 6 = 59 days in
    const semStart = new Date(now.getFullYear(), 0, 6);  // Jan 6
    const semEnd   = new Date(now.getFullYear(), 4, 9);  // May 9
    const total = semEnd - semStart;
    const elapsed = Math.min(Math.max(now - semStart, 0), total);
    const pct = total > 0 ? elapsed / total : 0;
    const circ = 2 * Math.PI * 19; // r=19
    setTimeout(() => {
      ring.style.strokeDashoffset = (circ * (1 - pct)).toFixed(2);
    }, 400);
  })();

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
            <div onclick="toggleTodo('${t.id}')" style="cursor:pointer;width:16px;height:16px;border-radius:4px;border:2px solid ${t.completed ? 'var(--success)' : 'var(--checkbox-border)'};background:${t.completed ? 'var(--success)' : 'transparent'};display:flex;align-items:center;justify-content:center;font-size:10px;color:white;flex-shrink:0;">${t.completed ? '✓' : ''}</div>
            <span style="font-size:13px;color:var(--text);${t.completed ? 'text-decoration:line-through;opacity:0.5' : ''};flex:1;">${t.text}</span>
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
    // Re-init bot with fresh data (won't double-greet after first init)
    if (typeof initCoursesBot === 'function') initCoursesBot();
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
    const targetGrade = c.targetGP ? GRADE_SCALE.find(g => Math.abs(g.gp - c.targetGP) < 0.01) : null;
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
      ${targetGrade ? `<div class="course-target-badge">🎯 ${targetGrade.letter} (${c.targetGP.toFixed(2)})</div>` : ''}
      ${avg && targetGrade ? `<div class="course-gpa-progress" style="color:${parseFloat(avg) >= targetGrade.min ? 'var(--success)' : 'var(--warning);'}">${parseFloat(avg) >= targetGrade.min ? '✅ On track' : `⚠️ ${(targetGrade.min - parseFloat(avg)).toFixed(1)}% below target`}</div>` : ''}
      <div class="course-actions">
        <button class="btn-secondary" style="flex:1;font-size:11px;padding:7px 6px;" onclick="viewCourse('${c.id}')">&#128202; Details</button>
        <button class="course-dist-btn" style="flex:1;" onclick="openDistModal('${c.id}')">&#9881; Marks</button>
        <button class="btn-primary" style="width:auto;flex:1;font-size:11px;padding:7px 6px;" onclick="openAssessmentModal('${c.id}')">+ Score</button>
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
      const tgp = document.getElementById('courseTargetGP');
      if (tgp) tgp.value = c.targetGP ? c.targetGP.toFixed(2) : '';
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
  const tgpVal = document.getElementById('courseTargetGP')?.value;
  const payload = {
    name, code: document.getElementById('courseCode').value.trim(),
    instructor: document.getElementById('courseInstructor').value.trim(),
    credits: parseInt(document.getElementById('courseCredits').value) || 3,
    ...(tgpVal ? { targetGP: parseFloat(tgpVal) } : {})
  };
  try {
    if (editingCourseId) {
      await api('PUT', `/academic/course/${editingCourseId}`, payload);
      toast('Course updated', 'success');
    } else {
      const course = await api('POST', '/academic/course', payload);
      // Server doesn't persist extra fields on POST — do a follow-up PUT
      if (tgpVal && course?.id) {
        await api('PUT', `/academic/course/${course.id}`, { targetGP: parseFloat(tgpVal) });
      }
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
  return pctToGrade(pct)?.letter || 'F';
}

// ── CHART THEME — called by dashboard toggleTheme() after mode switch ──
window.applyChartTheme = function () {
  const light    = document.body.classList.contains('light-mode');
  const tickC    = light ? '#55607a' : '#64748b';
  const gridC    = light ? 'rgba(99,102,241,0.09)' : 'rgba(255,255,255,0.05)';
  const legendC  = light ? '#55607a' : '#94a3b8';

  const all = [
    overviewChartInst, gradeDonutInst, overallTrendChartInst, courseDetailChartInst,
    ...Object.values(courseChartInsts)
  ].filter(Boolean);

  all.forEach(chart => {
    try {
      if (chart.options.plugins?.legend?.labels)
        chart.options.plugins.legend.labels.color = legendC;
      ['x', 'y'].forEach(axis => {
        if (chart.options.scales?.[axis]?.ticks)
          chart.options.scales[axis].ticks.color = tickC;
        if (chart.options.scales?.[axis]?.grid)
          chart.options.scales[axis].grid.color = gridC;
      });
      chart.update();
    } catch (e) { /* chart may have been destroyed */ }
  });
};

// ── START ──
init();

/* =================================================================
   COURSE BOT ASSISTANT + CGPA CALCULATOR
   ================================================================= */
let cbotHistory = [];
let cbotAwaitingCourseSetup = null;
let currentDistCourseId = null;

function initCoursesBot() {
  const msgBox = document.getElementById('cbotMessages');
  if (!msgBox) return;
  renderCGPACalc();
  if (cbotHistory.length > 0) return; // already greeted
  cbotAppendMsg('bot',
    `Hey! 👋 I’m your **Course Assistant**. I can help you:\n` +
    `• 📚 **Add courses** — say “add course [name]”\n` +
    `• 🎯 **Set targets** — say “set target for [course]”\n` +
    `• 📊 **Check CGPA** — say “my cgpa” or open the CGPA tab\n` +
    `• 📈 **Score needed** — say “what do I need in [course] for B+?”\n` +
    `• ⚙️ **Setup marks** — say “setup distribution for [course]”\n\nWhat would you like to do?`);
}

function cbotAppendMsg(role, text) {
  cbotHistory.push({ role, text });
  const msgBox = document.getElementById('cbotMessages');
  if (!msgBox) return;
  const div = document.createElement('div');
  div.className = `cbot-msg ${role}`;
  const html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\n/g,'<br>');
  div.innerHTML = `<div class="cbot-bubble">${html}</div>`;
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
}

function handleCBotKey(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendCBotMsg(); } }
function cbotQuick(text)   { const i=document.getElementById('cbotInput'); if(i){i.value=text;} sendCBotMsg(); }

/* Render clickable option-buttons below the last bot message */
function cbotAppendButtons(options) {
  const msgBox = document.getElementById('cbotMessages');
  if (!msgBox) return;
  // remove any existing option row first
  document.getElementById('cbotOptionRow')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'cbot-option-row';
  wrap.id = 'cbotOptionRow';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = `cbot-option-btn ${opt.cls || ''}`;
    btn.innerHTML = opt.label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    btn.onclick = () => {
      wrap.remove();
      // Handle special dist action
      if (typeof opt.value === 'string' && opt.value.startsWith('__dist__')) {
        const cid = opt.value.replace('__dist__', '');
        cbotHistory.push({ role: 'user', text: 'Setup Marks Distribution' });
        const d2 = document.createElement('div');
        d2.className = 'cbot-msg user';
        d2.innerHTML = `<div class="cbot-bubble">Setup Marks Distribution</div>`;
        msgBox.appendChild(d2);
        msgBox.scrollTop = msgBox.scrollHeight;
        openDistModal(cid);
        cbotAppendMsg('bot', `📝 Distribution modal opened! You can **drag & drop** or upload an image of your syllabus, then fill in the weights below it.`);
        return;
      }
      // Regular option — feed as user message into step handler
      const displayLabel = opt.label.split('—')[0].trim();
      cbotHistory.push({ role: 'user', text: displayLabel });
      const ud = document.createElement('div');
      ud.className = 'cbot-msg user';
      ud.innerHTML = `<div class="cbot-bubble">${escHtml(displayLabel)}</div>`;
      msgBox.appendChild(ud);
      msgBox.scrollTop = msgBox.scrollHeight;
      if (cbotAwaitingCourseSetup) {
        handleCbotSetupStep(String(opt.value !== undefined ? opt.value : opt.label));
      }
    };
    wrap.appendChild(btn);
  });
  msgBox.appendChild(wrap);
  msgBox.scrollTop = msgBox.scrollHeight;
}

function sendCBotMsg() {
  const inp = document.getElementById('cbotInput');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  cbotAppendMsg('user', text);
  if (cbotAwaitingCourseSetup) { handleCbotSetupStep(text); return; }
  processCBotMessage(text);
}

function handleCbotSetupStep(text) {
  const state = cbotAwaitingCourseSetup;
  if (state.step === 'name') {
    state.data.name = text; state.step = 'credits';
    cbotAppendMsg('bot', `Great! **"${escHtml(text)}"** — how many credit hours?`);
    cbotAppendButtons([
      { label: '1 Credit',    value: '1',   cls: 'credit-btn' },
      { label: '1.5 Credits', value: '1.5', cls: 'credit-btn' },
      { label: '2 Credits',   value: '2',   cls: 'credit-btn' },
      { label: '3 Credits',   value: '3',   cls: 'credit-btn' },
      { label: '4 Credits',   value: '4',   cls: 'credit-btn' },
    ]);
    return;
  }
  if (state.step === 'credits') {
    const cr = parseFloat(text);
    if (isNaN(cr) || cr < 0.5 || cr > 6) {
      cbotAppendMsg('bot', 'Please pick a valid credit value:');
      cbotAppendButtons([
        { label: '1 Credit',  value: '1', cls: 'credit-btn' },
        { label: '2 Credits', value: '2', cls: 'credit-btn' },
        { label: '3 Credits', value: '3', cls: 'credit-btn' },
      ]);
      return;
    }
    state.data.credits = cr; state.step = 'targetGP';
    cbotAppendMsg('bot', `**${cr}** credit${cr === 1 ? '' : 's'} noted! 🎯 What’s your **target grade**?`);
    cbotAppendButtons([
      { label: 'A  — 4.00', value: '4.00', cls: 'grade-btn' },
      { label: 'A− — 3.67', value: '3.67', cls: 'grade-btn' },
      { label: 'B+ — 3.33', value: '3.33', cls: 'grade-btn' },
      { label: 'B  — 3.00', value: '3.00', cls: 'grade-btn' },
      { label: 'B− — 2.67', value: '2.67', cls: 'grade-btn' },
      { label: 'C+ — 2.33', value: '2.33', cls: 'grade-btn' },
    ]);
    return;
  }
  if (state.step === 'targetGP') {
    let gp = null;
    const lm = GRADE_SCALE.find(g => g.letter.toLowerCase() === text.toLowerCase().trim());
    if (lm) { gp = lm.gp; } else {
      const n = parseFloat(text);
      if (!isNaN(n) && n >= 0 && n <= 4) {
        gp = GRADE_SCALE.reduce((b, g) => Math.abs(g.gp - n) < Math.abs(b.gp - n) ? g : b).gp;
      }
    }
    if (gp === null) {
      cbotAppendMsg('bot', 'Pick a target grade:');
      cbotAppendButtons([
        { label: 'A  — 4.00', value: '4.00', cls: 'grade-btn' },
        { label: 'A− — 3.67', value: '3.67', cls: 'grade-btn' },
        { label: 'B+ — 3.33', value: '3.33', cls: 'grade-btn' },
        { label: 'B  — 3.00', value: '3.00', cls: 'grade-btn' },
      ]);
      return;
    }
    state.data.targetGP = gp;
    const grade = GRADE_SCALE.find(g => g.gp === gp);
    cbotAwaitingCourseSetup = null;
    const d = state.data;
    cbotAppendMsg('bot', `Target **${grade?.letter} (${gp.toFixed(2)})** — ${grade?.label}! ⏳ Creating course…`);
    api('POST', '/academic/course', { name: d.name, code: '', instructor: '', credits: d.credits })
      .then(course => api('PUT', `/academic/course/${course.id}`, { targetGP: gp }).then(() => course))
      .then(course => {
        loadCourses();
        cbotAppendMsg('bot',
          `✅ **"${escHtml(d.name)}"** added — ${d.credits} credit${d.credits === 1 ? '' : 's'}, target **${grade?.letter}**!\n\n` +
          `📝 **Next step**: Set up your marks distribution so I can track weighted progress.\n` +
          `Upload a screenshot of your syllabus or fill it in manually!`);
        cbotAppendButtons([
          { label: '📊 Setup Marks Distribution', value: `__dist__${course.id}`, cls: 'grade-btn' },
        ]);
      })
      .catch(err => cbotAppendMsg('bot', `❌ Error: ${err.message}`));
    return;
  }
}

function processCBotMessage(msg) {
  const m = msg.toLowerCase();
  const courses = academicData?.courses || [];

  // Greeting
  if (/^(hi|hello|hey|hola|yo)\b/.test(m)) {
    const cgpa = calcCGPA(courses);
    cbotAppendMsg('bot', `Hello! 👋 ${cgpa!==null?`Your current CGPA is **${cgpa.toFixed(2)}**.`:`You have ${courses.length} course(s) set up.`}\n\nHow can I help you today?`);
    return;
  }
  // CGPA
  if (/cgpa|gpa|overall.?grade/.test(m)) {
    const cgpa = calcCGPA(courses);
    if (!courses.length) { cbotAppendMsg('bot','No courses yet. Say “add course [name]” to start!'); return; }
    if (cgpa === null) { cbotAppendMsg('bot',`You have ${courses.length} course(s) but no scores yet. Add some assessments first!`); return; }
    const breakdown = courses.map(c => {
      const g = calcCourseGrade(c);
      return g ? `• **${c.name}**: ${g.pct.toFixed(1)}% → ${g.letter} (${g.gp.toFixed(2)}) — ${g.label}` : `• **${c.name}**: No scores yet`;
    }).join('\n');
    cbotAppendMsg('bot', `📊 **Your CGPA: ${cgpa.toFixed(2)} / 4.00**\n\n${breakdown}\n\nOpen the **CGPA tab** for visual details!`);
    return;
  }
  // Add course
  if (/add.+course|new.+course|add course/i.test(m)) {
    const nameMatch = msg.match(/(?:add|new).*?course\s+[\u201c\"']?([A-Za-z0-9 ]+)[\u201d\"']?/i);
    const name = nameMatch ? nameMatch[1].trim() : null;
    if (name && name.length > 1) {
      cbotAwaitingCourseSetup = { step:'credits', data:{ name } };
      cbotAppendMsg('bot', `Adding **"${escHtml(name)}"**! How many credit hours?`);
      cbotAppendButtons([
        { label: '1 Credit',    value: '1',   cls: 'credit-btn' },
        { label: '1.5 Credits', value: '1.5', cls: 'credit-btn' },
        { label: '2 Credits',   value: '2',   cls: 'credit-btn' },
        { label: '3 Credits',   value: '3',   cls: 'credit-btn' },
        { label: '4 Credits',   value: '4',   cls: 'credit-btn' },
      ])
    } else {
      cbotAwaitingCourseSetup = { step:'name', data:{} };
      cbotAppendMsg('bot', `Sure! What’s the **course name**?`);
    }
    return;
  }
  // Setup distribution
  if (/setup|distribution|weight|marks.?dis/.test(m)) {
    let fc = null;
    courses.forEach(c => { if (m.includes(c.name.toLowerCase())||(c.code&&m.includes(c.code.toLowerCase()))) fc=c; });
    if (!fc && courses.length===1) fc=courses[0];
    if (!fc) {
      cbotAppendMsg('bot', `Which course? ${courses.length?'\n'+courses.map(c=>`• ${c.name}`).join('\n')+'\n\nSay “setup distribution for [name]”':'\nAdd a course first!'}`);
      return;
    }
    openDistModal(fc.id);
    cbotAppendMsg('bot', `📝 Opening distribution setup for **${escHtml(fc.name)}**. Fill in each type and its percentage weight!`);
    return;
  }
  // Score needed
  if (/score|mark.*(need|require)|(what|how).*(need|get|achieve)/.test(m)) {
    let fc = null;
    courses.forEach(c => { if (m.includes(c.name.toLowerCase())||(c.code&&m.includes(c.code.toLowerCase()))) fc=c; });
    if (!fc && courses.length===1) fc=courses[0];
    if (!fc) { cbotAppendMsg('bot','Which course? Say “what do I need in [course name] for B+?”'); return; }
    const gradeMatch = GRADE_SCALE.find(g => m.toLowerCase().includes(g.letter.toLowerCase()));
    const targetGP = gradeMatch?.gp ?? fc.targetGP ?? 3.00;
    const targetGrade = GRADE_SCALE.find(g => Math.abs(g.gp-targetGP)<0.01) || GRADE_SCALE[2];
    const current = calcCourseGrade(fc);
    const assessments = fc.assessments || [];
    const totalDistWeight = (fc.distribution||[]).reduce((s,d)=>s+d.weight,0);
    let reply = `📈 **${escHtml(fc.name)}** → Target: **${targetGrade.letter}** (${targetGP.toFixed(2)}) — ${targetGrade.label}\n\n`;
    if (current) reply += `Current: **${current.pct.toFixed(1)}%** (${current.letter})\n\n`;
    if (current && current.pct >= targetGrade.min) {
      reply += `✅ You’re already at or above your target! Great work 🙌`;
    } else if (totalDistWeight > 0) {
      const doneWeight = assessments.reduce((s,a) => {
        const d = (fc.distribution||[]).find(dd=>dd.type.toLowerCase()===a.type.toLowerCase());
        return s + (d ? d.weight/(d.count||1) : 0);
      }, 0);
      const earnedPts = assessments.reduce((s,a) => {
        const d = (fc.distribution||[]).find(dd=>dd.type.toLowerCase()===a.type.toLowerCase());
        return s + (d ? (parseFloat(a.percentage)/100)*(d.weight/(d.count||1)) : 0);
      }, 0);
      const remWeight = Math.max(0, 100 - doneWeight);
      if (remWeight <= 0) {
        reply += `All assessments are complete! Your final score is **${(earnedPts).toFixed(1)}%**.`;
      } else {
        const needed = ((targetGrade.min - earnedPts) / remWeight) * 100;
        if (needed > 100) {
          const maxScore = earnedPts + remWeight;
          const maxGrade = pctToGrade(maxScore);
          reply += `⚠️ To get ${targetGrade.letter} you’d need **${needed.toFixed(1)}%** in remaining work — not possible.\n\n`;
          reply += `🎯 **Best achievable: ${maxGrade.letter} (${maxGrade.gp.toFixed(2)})** if you score 100% on remaining work.`;
        } else if (needed <= 0) {
          reply += `✅ You’re already on track! Keep scoring well.`;
        } else {
          reply += `You need **${needed.toFixed(1)}%** on remaining weighted work (${remWeight.toFixed(0)}% weight left) to reach **${targetGrade.letter}**.`;
        }
      }
    } else if (assessments.length > 0) {
      const totalAssess = Math.max(assessments.length + 1, 5);
      const rem = totalAssess - assessments.length;
      const curSum = assessments.reduce((s,a)=>s+parseFloat(a.percentage),0);
      const needed = (targetGrade.min * totalAssess - curSum) / rem;
      reply += needed > 100
        ? `⚠️ You’d need ${needed.toFixed(1)}% on remaining assessments — difficult. Setup marks distribution for precise tracking.`
        : `You need **~${Math.max(0,needed).toFixed(1)}%** on remaining assessments (estimated). Set up marks distribution for accurate tracking!`;
    } else {
      reply += `No scores yet. Add assessments and I’ll calculate exactly what you need!`;
    }
    cbotAppendMsg('bot', reply);
    return;
  }
  // Fallback
  cbotAppendMsg('bot', `I can help with:\n• “my cgpa”\n• “add course [name]”\n• “what score do I need in [course] for [grade]”\n• “setup distribution for [course]”\n\nTry one of these! 😊`);
}

function switchCBotTab(tab, btn) {
  document.querySelectorAll('.cbot-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.cbot-pane').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  const pane = document.getElementById(`cbot-pane-${tab}`);
  if (pane) pane.classList.add('active');
  if (tab==='cgpa') renderCGPACalc();
}

function renderCGPACalc() {
  const courses = academicData?.courses || [];
  const cgpa    = calcCGPA(courses);

  const badge = document.getElementById('cbotCGPABadge');
  if (badge) badge.textContent = cgpa !== null ? `CGPA: ${cgpa.toFixed(2)}` : 'CGPA: —';

  const arc = document.getElementById('cgpaArcFill');
  const num = document.getElementById('cgpaBigNum');
  if (arc && num) {
    const circ = 172.79;
    const pct  = cgpa !== null ? Math.min(cgpa/4, 1) : 0;
    setTimeout(() => { arc.style.strokeDashoffset = (circ*(1-pct)).toFixed(2); }, 300);
    num.textContent = cgpa !== null ? cgpa.toFixed(2) : '—';
  }

  const bd = document.getElementById('cgpaBreakdown');
  if (bd) {
    bd.innerHTML = courses.map(c => {
      const g = calcCourseGrade(c);
      const col = g ? (g.gp>=3.33?'var(--success)':g.gp>=2?'var(--warning)':'var(--danger)') : 'var(--text-faint)';
      return `<div class="cgpa-course-row">
        <div class="cgpa-course-name">${escHtml(c.name)}</div>
        <div class="cgpa-course-letter" style="color:${col};background:${col}18">${g?g.letter:'—'}</div>
        <div class="cgpa-course-gp" style="color:${col}">${g?g.gp.toFixed(2):'—'}</div>
      </div>`;
    }).join('') || '<div style="color:var(--text-faint);font-size:12px;text-align:center;padding:8px;">Add courses and scores to see breakdown</div>';
  }

  const tbl = document.getElementById('gradeScaleTbl');
  if (tbl && !tbl.children.length) {
    tbl.innerHTML = GRADE_SCALE.map((g,i) => {
      const maxPct = i===0 ? 100 : (GRADE_SCALE[i-1].min - 1);
      return `<div class="grade-row">
        <span class="g-letter">${g.letter}</span>
        <span class="g-gp">${g.gp.toFixed(2)}</span>
        <span class="g-range">${g.min}–${maxPct}%</span>
      </div>`;
    }).join('');
  }

  const wr = document.getElementById('cgpaWhatIfRows');
  if (wr) {
    const opts = GRADE_SCALE.map(g=>`<option value="${g.gp}">${g.letter} – ${g.gp.toFixed(2)}</option>`).join('');
    wr.innerHTML = courses.map(c => {
      const g = calcCourseGrade(c);
      return `<div class="cgpa-whatif-row">
        <span class="wif-course">${escHtml(c.name)}</span>
        <select id="wif-${c.id}">${opts}</select>
      </div>`;
    }).join('') || '<div style="color:var(--text-faint);font-size:12px;padding:4px;">Add courses first</div>';
    courses.forEach(c => {
      const sel = document.getElementById(`wif-${c.id}`);
      const g   = calcCourseGrade(c);
      if (sel) sel.value = g ? g.gp.toFixed(2) : '3.00';
    });
  }
}

function calcWhatIfCGPA() {
  const courses = academicData?.courses || [];
  const el = document.getElementById('cgpaWhatIfResult');
  if (!courses.length) { if(el){el.style.display='block';el.textContent='Add courses first!';} return; }
  let tc=0, tp=0;
  courses.forEach(c => {
    const sel = document.getElementById(`wif-${c.id}`);
    const gp  = sel ? parseFloat(sel.value) : 3.00;
    const cr  = parseInt(c.credits) || 3;
    tc += cr; tp += cr*gp;
  });
  const wif   = tc > 0 ? (tp/tc).toFixed(2) : '—';
  const grade = pctToGrade(parseFloat(wif)/4*100);
  if (el) { el.style.display='block'; el.innerHTML=`What-If CGPA: <strong>${wif}</strong> / 4.00 &nbsp;·&nbsp; ${grade?.letter||'—'} — ${grade?.label||''}`; }
}

/* ── MARKS DISTRIBUTION MODAL ── */
function openDistModal(courseId) {
  if (!courseId) {
    // Called from header button — open for first course, or show selector
    const courses = academicData?.courses || [];
    if (!courses.length) { toast('Add a course first!','info'); return; }
    if (courses.length === 1) { courseId = courses[0].id; }
    else {
      const names = courses.map((c,i)=>`${i+1}. ${c.name}`).join('\n');
      const idx = parseInt(prompt(`Which course?\n${names}\n\nEnter number:`));
      if (isNaN(idx)||idx<1||idx>courses.length) return;
      courseId = courses[idx-1].id;
    }
  }
  currentDistCourseId = courseId;
  const course = (academicData?.courses||[]).find(c=>c.id===courseId);
  if (!course) return;

  document.getElementById('distModalTitle').textContent = `Marks Distribution — ${course.name}`;
  document.getElementById('distCourseInfo').innerHTML =
    `<strong>${escHtml(course.name)}</strong> &nbsp;·&nbsp; ${course.code||'No code'} &nbsp;·&nbsp; ${course.credits||3} credits`+
    `<span style="float:right;color:var(--text-muted);">${(course.assessments||[]).length} assessments recorded</span>`;

  const tgpSel = document.getElementById('distTargetGP');
  if (tgpSel) { tgpSel.value = course.targetGP ? course.targetGP.toFixed(2) : ''; updateDistTargetLabel(); }

  const distRows = document.getElementById('distRows');
  distRows.innerHTML = '';
  const dist = (course.distribution&&course.distribution.length)
    ? course.distribution
    : [{type:'Midterm',weight:30,count:1},{type:'Final Exam',weight:40,count:1},{type:'Quiz',weight:15,count:5},{type:'Assignment',weight:15,count:3}];
  dist.forEach(d => addDistRow(d));
  updateDistTotal();

  // Reset file preview
  const fp = document.getElementById('distFilePreview'); if(fp){fp.style.display='none';fp.innerHTML='';}
  document.getElementById('distUploadArea').innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><p>Upload your course syllabus or marks breakdown</p><span>Click to browse — image or PDF</span>`;

  openModal('distModal');
}

function openDistModalForCourse() {
  const id = editingCourseId || (academicData?.courses?.[0]?.id);
  if (id) openDistModal(id);
  else toast('Save the course first, then set up distribution.','info');
}

function addDistRow(data = {}) {
  const rows = document.getElementById('distRows');
  const row  = document.createElement('div');
  row.className = 'dist-row';
  row.innerHTML = `
    <input type="text"   placeholder="e.g. Midterm"  value="${escHtml(data.type||'')}" oninput="updateDistTotal()" />
    <input type="number" placeholder="Count" min="1" max="50" value="${data.count||1}" oninput="updateDistTotal()" style="width:60px;" />
    <input type="number" placeholder="0" min="0" max="100" step="0.5" value="${data.weight||''}" oninput="updateDistTotal()" style="width:65px;" />
    <span class="dist-pct">%</span>
    <button class="dist-del" onclick="this.closest('.dist-row').remove();updateDistTotal();" title="Remove">✕</button>`;
  rows.appendChild(row);
  updateDistTotal();
}

function updateDistTotal() {
  let total = 0;
  document.querySelectorAll('#distRows .dist-row').forEach(r => {
    total += parseFloat(r.querySelectorAll('input')[2]?.value) || 0;
  });
  const te = document.getElementById('distTotal');
  const se = document.getElementById('distTotalStatus');
  if (te) te.textContent = total.toFixed(0);
  if (se) {
    if (Math.abs(total-100)<0.5) { se.textContent='✓ Perfect'; se.className='dist-status ok'; }
    else if (total>100)           { se.textContent=`+${(total-100).toFixed(0)}% over`; se.className='dist-status err'; }
    else                          { se.textContent=`${(100-total).toFixed(0)}% remaining`; se.className='dist-status err'; }
  }
}

function updateDistTargetLabel() {
  const sel = document.getElementById('distTargetGP');
  const lbl = document.getElementById('distTargetLabel');
  if (!sel||!lbl) return;
  const gp    = parseFloat(sel.value);
  const grade = isNaN(gp) ? null : GRADE_SCALE.find(g=>Math.abs(g.gp-gp)<0.01);
  lbl.textContent = grade ? `→ ${grade.letter} · ${grade.label}` : '—';
}

async function saveDistribution() {
  const course = (academicData?.courses||[]).find(c=>c.id===currentDistCourseId);
  if (!course) return;
  const targetGP = parseFloat(document.getElementById('distTargetGP').value) || null;
  const distribution = [];
  document.querySelectorAll('#distRows .dist-row').forEach(r => {
    const inputs = r.querySelectorAll('input');
    const type   = inputs[0]?.value.trim();
    const count  = parseInt(inputs[1]?.value) || 1;
    const weight = parseFloat(inputs[2]?.value) || 0;
    if (type && weight > 0) distribution.push({ type, count, weight });
  });
  const total = distribution.reduce((s,d)=>s+d.weight, 0);
  if (Math.abs(total-100)>2) { toast('Weights must total 100%','error'); return; }
  try {
    await api('PUT', `/academic/course/${currentDistCourseId}`, { targetGP, distribution });
    academicData.courses = academicData.courses.map(c=>
      c.id===currentDistCourseId ? {...c, targetGP, distribution} : c);
    closeModal('distModal');
    renderCourses();
    renderCGPACalc();
    toast('Distribution saved!','success');
    const grade = targetGP ? GRADE_SCALE.find(g=>Math.abs(g.gp-targetGP)<0.01) : null;
    cbotAppendMsg('bot', `✅ Distribution saved for **${escHtml(course.name)}**!${grade?` Target: **${grade.letter}** (${targetGP.toFixed(2)})`:''} I’ll now track your weighted progress after each assessment!`);
  } catch(err) { toast(err.message,'error'); }
}

function handleDistUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const area    = document.getElementById('distUploadArea');
  const preview = document.getElementById('distFilePreview');
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = ev => {
      preview.style.display = 'block';
      preview.innerHTML = `<img src="${ev.target.result}" style="max-width:100%;max-height:180px;border-radius:8px;border:1px solid var(--border);" alt="Distribution sheet"/>
        <div style="font-size:11px;color:var(--text-muted);margin-top:5px;">📷 Fill in the weights below based on this sheet</div>`;
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'block';
    preview.innerHTML = `<div style="padding:8px;background:rgba(99,102,241,0.09);border-radius:6px;font-size:12px;">📄 ${escHtml(file.name)}<br><span style="color:var(--text-muted);">PDF loaded — fill in the weights below</span></div>`;
  }
  if (area) area.innerHTML = `<div style="color:var(--success);font-size:13px;">✓ File loaded — fill in the weights below</div>`;
}
