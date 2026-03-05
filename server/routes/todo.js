const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const UserData = require('../models/UserData');
const { auth } = require('./auth');

// GET all todos
router.get('/', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    res.json(ud?.todos || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADD todo
router.post('/', auth, async (req, res) => {
  try {
    const { text, date, priority, category } = req.body;
    const todo = {
      id: uuidv4(), text,
      date: date || new Date().toISOString().split('T')[0],
      priority: priority || 'medium', category: category || 'general',
      completed: false, createdAt: new Date().toISOString()
    };
    await UserData.findOneAndUpdate({ email: req.user.email }, { $push: { todos: todo } }, { upsert: true });
    res.json(todo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE todo
router.put('/:id', auth, async (req, res) => {
  try {
    const ud   = await UserData.findOne({ email: req.user.email });
    const todo = ud?.todos?.find(t => t.id === req.params.id);
    if (!todo) return res.status(404).json({ error: 'Not found' });
    Object.assign(todo, req.body, { updatedAt: new Date().toISOString() });
    await ud.save();
    res.json(todo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE todo
router.delete('/:id', auth, async (req, res) => {
  try {
    await UserData.findOneAndUpdate({ email: req.user.email }, { $pull: { todos: { id: req.params.id } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET day plan
router.get('/dayplan/:date', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    const plan = ud?.dayplans?.get(req.params.date) || { tasks: [], note: '' };
    res.json(plan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SAVE day plan
router.post('/dayplan/:date', auth, async (req, res) => {
  try {
    await UserData.findOneAndUpdate(
      { email: req.user.email },
      { $set: { ['dayplans.' + req.params.date]: req.body } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
