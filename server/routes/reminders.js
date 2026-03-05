const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { auth, getUserDir } = require('./auth');

function getReminders(email) {
  const f = path.join(getUserDir(email), 'reminders.json');
  return fs.readJsonSync(f, { throws: false }) || [];
}
function saveReminders(email, data) {
  fs.writeJsonSync(path.join(getUserDir(email), 'reminders.json'), data, { spaces: 2 });
}

router.get('/', auth, (req, res) => res.json(getReminders(req.user.email)));

router.post('/', auth, (req, res) => {
  const { title, datetime, type, courseId, repeat, note } = req.body;
  const reminders = getReminders(req.user.email);
  const reminder = {
    id: uuidv4(), title, datetime, type: type || 'custom',
    courseId: courseId || null, repeat: repeat || 'none',
    note: note || '', dismissed: false, createdAt: new Date().toISOString()
  };
  reminders.push(reminder);
  saveReminders(req.user.email, reminders);
  res.json(reminder);
});

router.put('/:id', auth, (req, res) => {
  const reminders = getReminders(req.user.email);
  const idx = reminders.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  reminders[idx] = { ...reminders[idx], ...req.body };
  saveReminders(req.user.email, reminders);
  res.json(reminders[idx]);
});

router.delete('/:id', auth, (req, res) => {
  let reminders = getReminders(req.user.email);
  reminders = reminders.filter(r => r.id !== req.params.id);
  saveReminders(req.user.email, reminders);
  res.json({ success: true });
});

// Get upcoming reminders (next 7 days)
router.get('/upcoming', auth, (req, res) => {
  const reminders = getReminders(req.user.email).filter(r => !r.dismissed);
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = reminders.filter(r => {
    const d = new Date(r.datetime);
    return d >= now && d <= week;
  }).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  res.json(upcoming);
});

module.exports = router;
