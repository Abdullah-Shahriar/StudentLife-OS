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

// DEMO LOGIN — auto-creates a pre-seeded demo account and returns a JWT
const DEMO_EMAIL = 'demo@studentlife.os';
const DEMO_NAME  = 'Abdul Shahriar';
const DEMO_PASS  = 'demoSL2026!';

router.post('/demo-login', async (req, res) => {
  try {
    let users = getUsers();
    let user  = users.find(u => u.email === DEMO_EMAIL);

    if (!user) {
      const hashed = await bcrypt.hash(DEMO_PASS, 10);
      user = {
        id: 'demo-student-001', email: DEMO_EMAIL,
        name: DEMO_NAME, phone: '+880 1700 000000',
        password: hashed, createdAt: new Date().toISOString(), isDemo: true
      };
      users.push(user);
      saveUsers(users);

      const dir = getUserDir(DEMO_EMAIL);
      const demoCourses = [
        { id:'dc1', name:'Machine Learning', code:'CSE4401', instructor:'Dr. Rahman', credits:3,
          targetGP:3.67,
          distribution:[{type:'Midterm',weight:30,count:1},{type:'Final',weight:40,count:1},{type:'Quiz',weight:15,count:5},{type:'Assignment',weight:15,count:3}],
          assessments:[
            {id:'da1',type:'quiz',title:'Quiz 1',score:17,totalScore:20,date:'2026-01-25',weight:5,percentage:'85.00',addedAt:new Date().toISOString()},
            {id:'da2',type:'classtest',title:'CT 1',score:18,totalScore:20,date:'2026-02-10',weight:10,percentage:'90.00',addedAt:new Date().toISOString()}
          ], createdAt:new Date().toISOString() },
        { id:'dc2', name:'Computer Networks', code:'CSE4301', instructor:'Dr. Islam', credits:3,
          targetGP:3.00,
          distribution:[{type:'Midterm',weight:30,count:1},{type:'Final',weight:40,count:1},{type:'Quiz',weight:20,count:5},{type:'Lab',weight:10,count:4}],
          assessments:[
            {id:'da3',type:'quiz',title:'Quiz 1',score:14,totalScore:20,date:'2026-01-22',weight:5,percentage:'70.00',addedAt:new Date().toISOString()}
          ], createdAt:new Date().toISOString() },
        { id:'dc3', name:'Software Engineering', code:'CSE4201', instructor:'Dr. Hossain', credits:3,
          targetGP:3.33, distribution:[], assessments:[], createdAt:new Date().toISOString() }
      ];
      fs.writeJsonSync(path.join(dir,'todos.json'),[
        {id:'t1',text:'Submit ML Assignment 3',priority:'high',done:false,dueDate:'2026-03-10',category:'assignment',createdAt:new Date().toISOString()},
        {id:'t2',text:'Prepare Networks Lab Report',priority:'medium',done:false,dueDate:'2026-03-12',category:'assignment',createdAt:new Date().toISOString()},
        {id:'t3',text:'Study for Compiler Design CT',priority:'high',done:true,dueDate:'2026-03-06',category:'exam',createdAt:new Date().toISOString()}
      ],{spaces:2});
      fs.writeJsonSync(path.join(dir,'academic.json'),{courses:demoCourses,calendar:[]},{spaces:2});
      fs.writeJsonSync(path.join(dir,'reminders.json'),[],{spaces:2});
      fs.writeJsonSync(path.join(dir,'dayplans.json'),{},{spaces:2});
      fs.writeJsonSync(path.join(dir,'sessions.json'),[],{spaces:2});
    }

    const token = jwt.sign({id:user.id,email:user.email,name:user.name}, SECRET, {expiresIn:'6h'});
    const sessionId = 'demo-' + Date.now();
    res.json({ token, user:{id:user.id,email:user.email,name:user.name,phone:user.phone}, sessionId });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.auth = auth;
module.exports.getUserDir = getUserDir;
