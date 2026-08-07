function renderEvents(filteredEvents = events) {
  const container = document.getElementById("events-container");

  if (!container) {
    return;
  }

  if (!filteredEvents.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No events found</h3>
        <p>Try changing your search or category.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = filteredEvents
    .map(
      (event) => `
        <article class="event-card">
          <div class="event-image">
            <img src="${event.image}" alt="${event.title}">
            <span class="event-category">${event.category}</span>
          </div>

          <div class="event-card-content">
            <h3>${event.title}</h3>

            <div class="event-meta">
              <span>📅 ${event.date}</span>
              <span>⏰ ${event.time}</span>
            </div>

            <p>${event.description}</p>

            <div class="event-footer">
              <strong>₹${event.price}</strong>

              <button
                class="btn btn-primary"
                onclick="openBookingModal(${event.id})"
              >
                Book Now
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function setupEventFilters() {
  const searchInput = document.getElementById("event-search");
  const categorySelect = document.getElementById("event-category");

  function filterEvents() {
    const search =
      searchInput?.value.toLowerCase().trim() || "";

    const category =
      categorySelect?.value || "all";

    const filtered = events.filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search);

      const matchesCategory =
        category === "all" ||
        event.category === category;

      return matchesSearch && matchesCategory;
    });

    renderEvents(filtered);
  }

  searchInput?.addEventListener("input", filterEvents);
  categorySelect?.addEventListener("change", filterEvents);
}