const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const connectDB = require('./db');

const app = express();

// ── Middleware ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Ensure DB is connected before any API request (required for Vercel cold starts)
app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) { res.status(503).json({ error: 'Database unavailable' }); }
});

// ── Routes ────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/todo',      require('./routes/todo'));
app.use('/api/academic',  require('./routes/academic'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/bot',       require('./routes/bot'));

// ── HTML pages ────────────────────────────────────────
app.get('/',          (_, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/signup',    (_, res) => res.sendFile(path.join(__dirname, '../public/signup.html')));
app.get('/dashboard', (_, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/admin',     (_, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));

// ── Local dev: connect + listen ──────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  connectDB()
    .then(() => {
      app.listen(PORT, () =>
        console.log(`🚀 StudentLife OS running at http://localhost:${PORT}`)
      );
    })
    .catch(err => {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

// ── Export for Vercel serverless ──────────────────────
module.exports = app;
