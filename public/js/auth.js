/* ========================
   auth.js – Login & Signup
   ======================== */

const API = '';  // Same origin

// ── UTILS ──
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}
function showSuccess(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
function clearMsg(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}
function setLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.opacity = loading ? '0' : '1';
  if (loader) loader.classList.toggle('hidden', !loading);
}

// Toggle password visibility
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.style.opacity = '1';
  } else {
    input.type = 'password';
    btn.style.opacity = '0.5';
  }
}

// Password strength
const pwInput = document.getElementById('signupPassword');
if (pwInput) {
  pwInput.addEventListener('input', () => {
    const val = pwInput.value;
    let strength = 0;
    if (val.length >= 6) strength++;
    if (val.length >= 10) strength++;
    if (/[A-Z]/.test(val)) strength++;
    if (/[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;

    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (!fill || !label) return;

    const levels = [
      { pct: 0, color: 'transparent', text: '' },
      { pct: 20, color: '#ef4444', text: 'Weak' },
      { pct: 40, color: '#f59e0b', text: 'Fair' },
      { pct: 60, color: '#eab308', text: 'Good' },
      { pct: 80, color: '#22c55e', text: 'Strong' },
      { pct: 100, color: '#10b981', text: 'Very Strong' },
    ];
    const lvl = levels[Math.min(strength, 5)];
    fill.style.width = lvl.pct + '%';
    fill.style.background = lvl.color;
    label.textContent = lvl.text;
    label.style.color = lvl.color;
  });
}

// ── CHECK AUTH ──
(function() {
  const token = localStorage.getItem('sl_token');
  const isAuthPage = window.location.pathname === '/' || window.location.pathname === '/signup';
  if (token && isAuthPage) {
    window.location.href = '/dashboard';
  }
  if (!token && !isAuthPage) {
    window.location.href = '/';
  }
})();

// ── LOGIN ──
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg('loginError');
    const btn = document.getElementById('loginBtn');
    setLoading(btn, true);

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('sl_token', data.token);
      localStorage.setItem('sl_user', JSON.stringify(data.user));
      localStorage.setItem('sl_session', data.sessionId);
      // Show cinematic success animation, then redirect
      if (typeof window.triggerLoginSuccess === 'function') {
        window.triggerLoginSuccess(() => { window.location.href = '/dashboard'; });
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      showError('loginError', err.message);
      setLoading(btn, false);
    }
  });
}

// ── SIGNUP ──
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg('signupError');
    clearMsg('signupSuccess');
    const btn = document.getElementById('signupBtn');

    const name = document.getElementById('signupName').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;

    if (password !== confirm) {
      showError('signupError', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      showError('signupError', 'Password must be at least 6 characters');
      return;
    }

    setLoading(btn, true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      showSuccess('signupSuccess', '✅ Account created! Redirecting to login...');
      setTimeout(() => window.location.href = '/', 1800);
    } catch (err) {
      showError('signupError', err.message);
      setLoading(btn, false);
    }
  });
}
