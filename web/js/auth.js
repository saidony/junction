function showAuth(mode = "signup") {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  switchAuthTab(mode);
  clearAuthErrors();
}

function closeAuth() {
  document.getElementById("auth-modal")?.classList.add("hidden");
}

function switchAuthTab(mode) {
  const login = document.getElementById("login-form");
  const signup = document.getElementById("signup-form");
  const loginTab = document.getElementById("login-tab");
  const signupTab = document.getElementById("signup-tab");

  const isLogin = mode === "login";
  login?.classList.toggle("hidden", !isLogin);
  signup?.classList.toggle("hidden", isLogin);
  loginTab?.classList.toggle("active", isLogin);
  signupTab?.classList.toggle("active", !isLogin);
  clearAuthErrors();
}

function clearAuthErrors() {
  const error = document.getElementById("auth-error");
  if (error) {
    error.textContent = "";
    error.classList.add("hidden");
  }
}

function authError(message) {
  const error = document.getElementById("auth-error");
  if (!error) return;
  error.textContent = message;
  error.classList.remove("hidden");
}

async function signup(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;

  try {
    const body = {
      name: form.name.value,
      email: form.email.value,
      mobile: form.mobile.value,
      password: form.password.value
    };

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to create account.");
    }

    setSession(data.token, data.user);
    form.reset();
    closeAuth();
    updateAuthUI();
    await loadMyBookings();
    showToast("Account created successfully.");
  } catch (error) {
    authError(error.message);
  } finally {
    button.disabled = false;
  }
}

async function login(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.value,
        password: form.password.value
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to login.");
    }

    setSession(data.token, data.user);
    form.reset();
    closeAuth();
    updateAuthUI();
    await loadMyBookings();
    showToast("Welcome back.");
  } catch (error) {
    authError(error.message);
  } finally {
    button.disabled = false;
  }
}

async function googleCredentialResponse(response) {
  try {
    const result = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await result.json();

    if (!result.ok || !data.success) {
      throw new Error(data.message || "Google Sign-In failed.");
    }

    setSession(data.token, data.user);
    closeAuth();
    updateAuthUI();
    await loadMyBookings();
    showToast("Signed in with Google.");
  } catch (error) {
    authError(error.message);
  }
}

function initGoogleSignIn() {
  const clientId = window.JUNCTION_GOOGLE_CLIENT_ID || "";
  const button = document.getElementById("google-signin");

  if (!button || !clientId || !window.google?.accounts?.id) {
    if (button) button.classList.add("hidden");
    return;
  }

  button.classList.remove("hidden");

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: googleCredentialResponse
  });

  window.google.accounts.id.renderButton(button, {
    theme: "outline",
    size: "large",
    width: "100%"
  });
}

async function restoreSession() {
  loadCachedUser();

  if (!state.token) {
    updateAuthUI();
    return;
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      clearSession();
    } else {
      state.user = data.user;
    }
  } catch {
    // Keep the local session until the server can be reached again.
  }

  updateAuthUI();
}

function logout() {
  clearSession();
  updateAuthUI();
  renderBookings();
  showToast("Logged out.");
}

function updateAuthUI() {
  const loginButton = document.getElementById("login-button");
  const signupButton = document.getElementById("signup-button");
  const userArea = document.getElementById("user-area");
  const userName = document.getElementById("user-name");
  const bookingsLink = document.getElementById("bookings-link");

  const loggedIn = Boolean(state.user);

  loginButton?.classList.toggle("hidden", loggedIn);
  signupButton?.classList.toggle("hidden", loggedIn);
  userArea?.classList.toggle("hidden", !loggedIn);
  bookingsLink?.classList.toggle("hidden", !loggedIn);

  if (userName) userName.textContent = loggedIn ? state.user.name : "";
}
