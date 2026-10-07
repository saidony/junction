async function loadEvents() {
  const category = state.category || "All";
  const response = await fetch(`/api/events?category=${encodeURIComponent(category)}`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load events.");
  }

  state.events = data.events || [];
  renderEvents();
}

function renderEvents() {
  const container = document.getElementById("events-grid");
  if (!container) return;

  if (!state.events.length) {
    container.innerHTML = `<div class="empty-state">No events found.</div>`;
    return;
  }

  container.innerHTML = state.events.map((event) => {
    const isSoldOut = Number(event.availableSeats) <= 0;
    return `
    <article class="event-card">
      <div class="event-badge">${escapeHtml(event.category)}</div>
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(event.description)}</p>
      <div class="event-meta">
        <span>📅 ${escapeHtml(event.date)}</span>
        <span>⏰ ${escapeHtml(event.time)}</span>
        <span>📍 ${escapeHtml(event.venue)}</span>
      </div>
      <div class="event-bottom">
        <strong>₹${event.price}</strong>
        <span>${isSoldOut ? "Sold Out" : `${event.availableSeats} seats left`}</span>
      </div>
      <button class="primary-btn" ${isSoldOut ? "disabled" : ""} onclick="openSeatPicker('${event.id}')">
        ${isSoldOut ? "Sold Out" : "Select Seats"}
      </button>
    </article>
  `;
  }).join("");
}

function renderCategories() {
  const container = document.getElementById("categories");
  if (!container) return;

  container.innerHTML = fallbackCategories.map((category) => `
    <button class="category-btn ${state.category === category ? "active" : ""}"
      onclick="selectCategory('${category}')">
      ${escapeHtml(category)}
    </button>
  `).join("");
}

async function selectCategory(category) {
  state.category = category;
  renderCategories();
  try {
    await loadEvents();
  } catch (error) {
    showToast(error.message, "error");
  }
}
