async function loadMyBookings() {
  if (!state.token) {
    state.bookings = [];
    renderBookings();
    return;
  }

  try {
    const response = await fetch("/api/bookings", {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load bookings.");
    }

    state.bookings = data.bookings || [];
    renderBookings();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderBookings() {
  const container = document.getElementById("bookings-list");
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `<div class="empty-state">Login to see your bookings.</div>`;
    return;
  }

  if (!state.bookings.length) {
    container.innerHTML = `<div class="empty-state">You have no bookings yet.</div>`;
    return;
  }

  container.innerHTML = state.bookings.map((booking) => `
    <div class="booking-card">
      <div>
        <h3>${escapeHtml(booking.event?.title || "Event")}</h3>
        <p>${escapeHtml(booking.event?.date || "")} · ${escapeHtml(booking.event?.venue || "")}</p>
        <p>Seats: <strong>${escapeHtml((booking.seats || []).join(", "))}</strong></p>
        <p>Total: <strong>₹${Number(booking.total || 0)}</strong></p>
      </div>
      <div class="booking-actions">
        <span class="status ${booking.status}">${escapeHtml(booking.status)}</span>
        ${booking.status === "confirmed"
          ? `<button class="danger-btn" onclick="cancelBooking('${booking.id}')">Cancel</button>`
          : ""}
      </div>
    </div>
  `).join("");
}

async function cancelBooking(bookingId) {
  if (!confirm("Cancel this booking?")) return;

  try {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to cancel booking.");
    }

    await loadEvents();
    await loadMyBookings();
    showToast("Booking cancelled.");
  } catch (error) {
    showToast(error.message, "error");
  }
}
