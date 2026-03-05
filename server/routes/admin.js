const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const UserData = require('../models/UserData');
const { adminAuth } = require('./auth');

// GET all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').lean();
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all session logs
router.get('/logs', adminAuth, async (req, res) => {
  try {
    const data = await UserData.find().select('email name phone sessions').lean();
    const logs = {};
    data.forEach(d => { logs[d.email] = d; });
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET logs for specific user
router.get('/logs/:email', adminAuth, async (req, res) => {
  try {
    const ud = await UserData.findOne({ email: req.params.email }).select('email name sessions').lean();
    if (!ud) return res.status(404).json({ error: 'User not found' });
    res.json(ud);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET summary
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').lean();
    const udata = await UserData.find().select('email sessions').lean();
    const dataMap = {};
    udata.forEach(d => { dataMap[d.email] = d; });

    const summary = users.map(u => {
      const d        = dataMap[u.email] || { sessions: [] };
      const sessions = d.sessions || [];
      const last     = sessions[sessions.length - 1] || null;
      const tools    = sessions.flatMap(s => (s.toolsUsed || []).map(t => t.tool || t));
      const toolCounts = tools.reduce((acc, t) => { acc[t] = (acc[t]||0)+1; return acc; }, {});
      return {
        ...u, totalLogins: sessions.length,
        lastLogin:  last?.loginTime  || null,
        lastLogout: last?.logoutTime || null,
        topTools: Object.entries(toolCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([tool,count])=>({tool,count})),
        sessions: sessions.slice(-10)
      };
    });
    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
