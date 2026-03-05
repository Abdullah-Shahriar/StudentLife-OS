const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directories exist
const dataDir = path.join(__dirname, 'data');
fs.ensureDirSync(dataDir);
fs.ensureDirSync(path.join(dataDir, 'users'));
if (!fs.existsSync(path.join(dataDir, 'users.json'))) {
  fs.writeJsonSync(path.join(dataDir, 'users.json'), []);
}
if (!fs.existsSync(path.join(dataDir, 'admin_logs.json'))) {
  fs.writeJsonSync(path.join(dataDir, 'admin_logs.json'), {});
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/todo', require('./routes/todo'));
app.use('/api/academic', require('./routes/academic'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/bot', require('./routes/bot'));

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, '../public/signup.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 StudentLife OS running at http://localhost:${PORT}\n`);
});
