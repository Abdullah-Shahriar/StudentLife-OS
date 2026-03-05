const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const ADMIN_EMAIL    = 'host@shahriar.com';
const ADMIN_PASSWORD = '2803';
const usersFile = path.join(__dirname, '../data/users.json');
const adminLogsFile = path.join(__dirname, '../data/admin_logs.json');

function verifyAdmin(req, res, next) {
  const email    = req.headers['x-admin-email']    || req.query.email;
  const password = req.headers['x-admin-password'] || req.query.password;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) { next(); return; }
  return res.status(403).json({ error: 'Forbidden – invalid credentials' });
}

// GET all users list
router.get('/users', verifyAdmin, (req, res) => {
  const users = fs.readJsonSync(usersFile, { throws: false }) || [];
  const safe = users.map(({ password, ...u }) => u);
  res.json(safe);
});

// GET all session logs
router.get('/logs', verifyAdmin, (req, res) => {
  const logs = fs.readJsonSync(adminLogsFile, { throws: false }) || {};
  res.json(logs);
});

// GET logs for specific user by email
router.get('/logs/:email', verifyAdmin, (req, res) => {
  const logs = fs.readJsonSync(adminLogsFile, { throws: false }) || {};
  const userLog = logs[req.params.email];
  if (!userLog) return res.status(404).json({ error: 'User not found in logs' });
  res.json(userLog);
});

// GET summary stats
router.get('/summary', verifyAdmin, (req, res) => {
  const users = fs.readJsonSync(usersFile, { throws: false }) || [];
  const logs = fs.readJsonSync(adminLogsFile, { throws: false }) || {};

  const summary = users.map(({ password, ...u }) => {
    const log = logs[u.email] || { sessions: [] };
    const sessions = log.sessions || [];
    const lastSession = sessions[sessions.length - 1] || null;
    const totalLogins = sessions.length;
    const tools = sessions.flatMap(s => (s.toolsUsed || []).map(t => t.tool));
    const toolCounts = tools.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
    return {
      ...u,
      totalLogins,
      lastLogin: lastSession?.loginTime || null,
      lastLogout: lastSession?.logoutTime || null,
      topTools: Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tool, count]) => ({ tool, count })),
      sessions: sessions.slice(-10)
    };
  });
  res.json(summary);
});

module.exports = router;
