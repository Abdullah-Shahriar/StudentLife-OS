const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { auth, getUserDir } = require('./auth');

function getTodos(email) {
  const f = path.join(getUserDir(email), 'todos.json');
  return fs.readJsonSync(f, { throws: false }) || [];
}
function saveTodos(email, data) {
  fs.writeJsonSync(path.join(getUserDir(email), 'todos.json'), data, { spaces: 2 });
}
function getDayPlans(email) {
  const f = path.join(getUserDir(email), 'dayplans.json');
  return fs.readJsonSync(f, { throws: false }) || {};
}
function saveDayPlans(email, data) {
  fs.writeJsonSync(path.join(getUserDir(email), 'dayplans.json'), data, { spaces: 2 });
}

// GET all todos
router.get('/', auth, (req, res) => {
  res.json(getTodos(req.user.email));
});

// ADD todo
router.post('/', auth, (req, res) => {
  const { text, date, priority, category } = req.body;
  const todos = getTodos(req.user.email);
  const todo = {
    id: uuidv4(), text,
    date: date || new Date().toISOString().split('T')[0],
    priority: priority || 'medium',
    category: category || 'general',
    completed: false,
    createdAt: new Date().toISOString()
  };
  todos.push(todo);
  saveTodos(req.user.email, todos);
  res.json(todo);
});

// UPDATE todo (toggle complete or edit)
router.put('/:id', auth, (req, res) => {
  const todos = getTodos(req.user.email);
  const idx = todos.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  todos[idx] = { ...todos[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveTodos(req.user.email, todos);
  res.json(todos[idx]);
});

// DELETE todo
router.delete('/:id', auth, (req, res) => {
  let todos = getTodos(req.user.email);
  todos = todos.filter(t => t.id !== req.params.id);
  saveTodos(req.user.email, todos);
  res.json({ success: true });
});

// DAY PLAN: get plan for a date
router.get('/dayplan/:date', auth, (req, res) => {
  const plans = getDayPlans(req.user.email);
  res.json(plans[req.params.date] || { tasks: [], note: '' });
});

// DAY PLAN: save plan for a date
router.post('/dayplan/:date', auth, (req, res) => {
  const plans = getDayPlans(req.user.email);
  plans[req.params.date] = req.body;
  saveDayPlans(req.user.email, plans);
  res.json({ success: true });
});

module.exports = router;
