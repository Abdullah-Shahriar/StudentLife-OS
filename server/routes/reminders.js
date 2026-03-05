const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const UserData = require('../models/UserData');
const { auth } = require('./auth');

router.get('/', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    res.json(ud?.reminders || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, datetime, type, courseId, repeat, note } = req.body;
    const reminder = { id: uuidv4(), title, datetime, type: type || 'custom',
      courseId: courseId || null, repeat: repeat || 'none', note: note || '',
      dismissed: false, createdAt: new Date().toISOString() };
    await UserData.findOneAndUpdate({ email: req.user.email }, { $push: { reminders: reminder } }, { upsert: true });
    res.json(reminder);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.user.email });
    const r  = ud?.reminders?.find(r => r.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    Object.assign(r, req.body);
    await ud.save();
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await UserData.findOneAndUpdate({ email: req.user.email }, { $pull: { reminders: { id: req.params.id } } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/upcoming', auth, async (req, res) => {
  try {
    const ud  = await UserData.findOne({ email: req.user.email });
    const now  = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = (ud?.reminders || [])
      .filter(r => !r.dismissed && new Date(r.datetime) >= now && new Date(r.datetime) <= week)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    res.json(upcoming);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
