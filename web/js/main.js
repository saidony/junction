function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3200);
}

async function loadConfig() {
  try {
    if (!window.JUNCTION_GOOGLE_CLIENT_ID) {
      const response = await fetch("/api/config");
      const data = await response.json();
      if (data.success && data.googleClientId) {
        window.JUNCTION_GOOGLE_CLIENT_ID = data.googleClientId;
        initGoogleSignIn();
      }
    }
  } catch {
    // Optional config check; proceed without error
  }
}

async function checkHealth() {
  const indicator = document.getElementById("db-status");
  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    if (indicator) {
      const isConnected = data.database === "connected";
      const dbLabel = data.dbType === "mongodb" ? "Database connected (MongoDB)" : "Database connected (Local DB)";
      indicator.textContent = isConnected ? dbLabel : "Database unavailable";
      indicator.className = isConnected ? "db-status db-ok" : "db-status db-error";
    }
  } catch {
    if (indicator) {
      indicator.textContent = "Server unavailable";
      indicator.className = "db-status db-error";
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderCategories();
  await loadConfig();
  await restoreSession();
  initGoogleSignIn();

  try {
    await loadEvents();
    await loadMyBookings();
  } catch (error) {
    showToast(error.message, "error");
  }

  checkHealth();
});
