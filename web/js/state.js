const state = {
  user: null,
  token: localStorage.getItem("junction_token") || "",
  events: [],
  bookings: [],
  selectedEvent: null,
  selectedSeats: new Set(),
  category: "All"
};

function setSession(token, user) {
  state.token = token || "";
  state.user = user || null;

  if (state.token) localStorage.setItem("junction_token", state.token);
  else localStorage.removeItem("junction_token");

  localStorage.setItem("junction_user", JSON.stringify(state.user || null));
}

function clearSession() {
  state.token = "";
  state.user = null;
  state.bookings = [];
  localStorage.removeItem("junction_token");
  localStorage.removeItem("junction_user");
}

function loadCachedUser() {
  try {
    const saved = JSON.parse(localStorage.getItem("junction_user") || "null");
    if (saved) state.user = saved;
  } catch {
    state.user = null;
  }
}
