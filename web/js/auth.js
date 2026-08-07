/* ============================================================
   auth.js
   Everything related to signing in, signing up, and logging
   out. This is a client-only demo auth system — "users" is an
   in-memory array (see state.js), so accounts do not persist
   across a page refresh. Swap this file out for real API calls
   if you connect a backend later.
   ============================================================ */

function switchTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  const heading = document.querySelector('#page-login .login-right > div:first-child > div:first-child');
  if (heading) heading.textContent = tab === 'login' ? 'Welcome Back' : 'Create Your Account';
  clearErrors();
}

function clearErrors() {
  ['login-email-err', 'login-pass-err', 'login-general-err', 'reg-email-err', 'reg-pass-err', 'reg-general-err']
    .forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
}

function doLogin() {
  clearErrors();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;

  if (!email) { document.getElementById('login-email-err').textContent = 'Email is required'; return; }
  if (!pass) { document.getElementById('login-pass-err').textContent = 'Password is required'; return; }

  const user = users.find(u => u.email === email && u.pass === pass);
  if (!user) { document.getElementById('login-general-err').textContent = 'Invalid email or password'; return; }

  loginSuccess(user);
}

function doSignup() {
  clearErrors();
  const fname = document.getElementById('reg-fname').value.trim();
  const lname = document.getElementById('reg-lname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass = document.getElementById('reg-pass').value;

  if (!fname || !lname || !email || !phone || !pass) {
    document.getElementById('reg-general-err').textContent = 'Please fill in all fields';
    return;
  }
  if (pass.length < 6) {
    document.getElementById('reg-pass-err').textContent = 'Min. 6 characters';
    return;
  }
  if (users.find(u => u.email === email)) {
    document.getElementById('reg-email-err').textContent = 'Account already exists';
    return;
  }

  users.push({ email, pass, fname, lname, phone });
  loginSuccess(users[users.length - 1]);
}

function loginSuccess(user) {
  currentUser = user;
  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('nav-username').textContent = user.fname;
  showToast('Welcome, ' + user.fname + '! 🎉');
  showPage('home');
}

function logout() {
  currentUser = null;
  document.getElementById('nav-auth').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
  showToast('Logged out successfully');
  showPage('home');
}