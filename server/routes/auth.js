const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SECRET = 'studentlife_jwt_secret_2026';
const usersFile = path.join(__dirname, '../data/users.json');
const adminLogsFile = path.join(__dirname, '../data/admin_logs.json');

function getUsers() { return fs.readJsonSync(usersFile, { throws: false }) || []; }
function saveUsers(u) { fs.writeJsonSync(usersFile, u, { spaces: 2 }); }
function getLogs() { return fs.readJsonSync(adminLogsFile, { throws: false }) || {}; }
function saveLogs(l) { fs.writeJsonSync(adminLogsFile, l, { spaces: 2 }); }
function getUserDir(email) {
  const dir = path.join(__dirname, '../data/users', email.replace(/[^a-zA-Z0-9]/g, '_'));
  fs.ensureDirSync(dir);
  return dir;
}

// Middleware
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// SIGNUP
router.post('/signup', async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password || !name || !phone)
    return res.status(400).json({ error: 'All fields required' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'Invalid email format' });

  const users = getUsers();
  if (users.find(u => u.email === email))
    return res.status(400).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), email, password: hashed, name, phone, createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);

  // Initialize user data files
  const dir = getUserDir(email);
  fs.writeJsonSync(path.join(dir, 'todos.json'), [], { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'academic.json'), { courses: [], calendar: [] }, { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'reminders.json'), [], { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'dayplans.json'), {}, { spaces: 2 });
  fs.writeJsonSync(path.join(dir, 'sessions.json'), [], { spaces: 2 });

  res.json({ success: true, message: 'Account created successfully' });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '24h' });

  // Log session
  const dir = getUserDir(email);
  const sessionsFile = path.join(dir, 'sessions.json');
  const sessions = fs.readJsonSync(sessionsFile, { throws: false }) || [];
  const sessionId = uuidv4();
  sessions.push({ sessionId, loginTime: new Date().toISOString(), logoutTime: null, toolsUsed: [] });
  fs.writeJsonSync(sessionsFile, sessions, { spaces: 2 });

  // Admin logs
  const logs = getLogs();
  if (!logs[email]) logs[email] = { name: user.name, email, phone: user.phone, sessions: [] };
  logs[email].sessions.push({ sessionId, loginTime: new Date().toISOString(), logoutTime: null, toolsUsed: [] });
  saveLogs(logs);

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone }, sessionId });
});

// LOGOUT
router.post('/logout', auth, (req, res) => {
  const { sessionId } = req.body;
  const { email } = req.user;

  const dir = getUserDir(email);
  const sessionsFile = path.join(dir, 'sessions.json');
  const sessions = fs.readJsonSync(sessionsFile, { throws: false }) || [];
  const s = sessions.find(s => s.sessionId === sessionId);
  if (s) s.logoutTime = new Date().toISOString();
  fs.writeJsonSync(sessionsFile, sessions, { spaces: 2 });

  const logs = getLogs();
  if (logs[email]) {
    const ls = logs[email].sessions.find(s => s.sessionId === sessionId);
    if (ls) ls.logoutTime = new Date().toISOString();
    saveLogs(logs);
  }
  res.json({ success: true });
});

// LOG TOOL USAGE
router.post('/log-tool', auth, (req, res) => {
  const { sessionId, tool } = req.body;
  const { email } = req.user;

  const dir = getUserDir(email);
  const sessionsFile = path.join(dir, 'sessions.json');
  const sessions = fs.readJsonSync(sessionsFile, { throws: false }) || [];
  const s = sessions.find(s => s.sessionId === sessionId);
  if (s) s.toolsUsed.push({ tool, at: new Date().toISOString() });
  fs.writeJsonSync(sessionsFile, sessions, { spaces: 2 });

  const logs = getLogs();
  if (logs[email]) {
    const ls = logs[email].sessions.find(s => s.sessionId === sessionId);
    if (ls) ls.toolsUsed.push({ tool, at: new Date().toISOString() });
    saveLogs(logs);
  }
  res.json({ success: true });
});

// GET PROFILE
router.get('/profile', auth, (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.email === req.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...safe } = user;
  res.json(safe);
});

module.exports = router;
module.exports.auth = auth;
module.exports.getUserDir = getUserDir;
