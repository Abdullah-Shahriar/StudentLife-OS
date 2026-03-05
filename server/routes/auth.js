const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User     = require('../models/User');
const UserData = require('../models/UserData');

const SECRET = process.env.JWT_SECRET || 'studentlife_jwt_secret_2026';

// Auth middleware
async function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

// Admin credentials middleware
function adminAuth(req, res, next) {
  const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'host@shahriar.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2803';
  const ADMIN_CODE     = process.env.ADMIN_CODE     || 'host2026';
  const code  = req.headers['x-admin-code']  || req.query.code;
  const email = req.headers['x-admin-email'] || req.query.email;
  const pass  = req.headers['x-admin-password'] || req.headers['x-admin-pass'] || req.query.pass;
  if (code === ADMIN_CODE || (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD)) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name || !phone)
      return res.status(400).json({ error: 'All fields required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Invalid email format' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ id: uuidv4(), email: email.toLowerCase(), password: hashed, name, phone });
    await UserData.create({ email: user.email, name, phone });
    res.json({ success: true, message: 'Account created successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (!(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: 'Invalid credentials' });
    const token     = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '24h' });
    const sessionId = uuidv4();
    await UserData.findOneAndUpdate(
      { email: user.email },
      { $push: { sessions: { sessionId, loginTime: new Date().toISOString(), logoutTime: null, toolsUsed: [] } } },
      { upsert: true }
    );
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone }, sessionId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DEMO AUTO-LOGIN — creates demo account if not exists
router.post('/demo-login', async (req, res) => {
  try {
    const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@studentlifeos.app';
    const DEMO_PASS  = process.env.DEMO_PASS  || 'demo2026';
    let user = await User.findOne({ email: DEMO_EMAIL });
    if (!user) {
      const hashed = await bcrypt.hash(DEMO_PASS, 10);
      user = await User.create({ id: uuidv4(), email: DEMO_EMAIL, password: hashed, name: 'Demo User', phone: '0000000000' });
      await UserData.create({ email: DEMO_EMAIL, name: 'Demo User', phone: '0000000000',
        todos: [
          { id: uuidv4(), text: 'Review ML Assignment', date: new Date().toISOString().split('T')[0], priority: 'high', category: 'assignment', completed: false, createdAt: new Date().toISOString() },
          { id: uuidv4(), text: 'Study for Networks Quiz', date: new Date().toISOString().split('T')[0], priority: 'medium', category: 'study', completed: false, createdAt: new Date().toISOString() }
        ]
      });
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '2h' });
    const sessionId = uuidv4();
    await UserData.findOneAndUpdate(
      { email: DEMO_EMAIL },
      { $push: { sessions: { sessionId, loginTime: new Date().toISOString(), logoutTime: null, toolsUsed: [] } } },
      { upsert: true }
    );
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone }, sessionId, isDemo: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOGOUT
router.post('/logout', auth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    await UserData.findOneAndUpdate(
      { email: req.user.email, 'sessions.sessionId': sessionId },
      { $set: { 'sessions.$.logoutTime': new Date().toISOString() } }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOG TOOL
router.post('/log-tool', auth, async (req, res) => {
  try {
    const { sessionId, tool } = req.body;
    await UserData.findOneAndUpdate(
      { email: req.user.email, 'sessions.sessionId': sessionId },
      { $push: { 'sessions.$.toolsUsed': { tool, time: new Date().toISOString() } } }
    );
    res.json({ success: true });
  } catch { res.status(200).json({ success: true }); }
});

// GET PROFILE
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.auth      = auth;
module.exports.adminAuth = adminAuth;
