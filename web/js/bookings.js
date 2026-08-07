function renderBookings() {
  const container = document.getElementById("bookings-container");

  if (!container) {
    return;
  }

  const bookings =
    JSON.parse(localStorage.getItem("junction_bookings")) || [];

  if (!bookings.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No bookings yet</h3>
        <p>Your booked events will appear here.</p>
        <button class="btn btn-primary" onclick="navigateTo('events')">
          Explore Events
        </button>
      </div>
    `;

    return;
  }

  container.innerHTML = bookings
    .map(
      (booking) => `
        <article class="booking-card">
          <div>
            <h3>${booking.eventTitle}</h3>
            <p>📅 ${booking.date}</p>
            <p>🎟️ ${booking.tickets} ticket(s)</p>
          </div>

          <div class="booking-price">
            ₹${booking.total}
          </div>
        </article>
      `
    )
    .join("");
}