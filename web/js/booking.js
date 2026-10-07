function openSeatPicker(eventId) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;

  state.selectedEvent = event;
  state.selectedSeats = new Set();

  const modal = document.getElementById("seat-modal");
  const title = document.getElementById("seat-event-title");
  const grid = document.getElementById("seat-grid");

  if (!modal || !grid) return;

  title.textContent = event.title;
  const booked = new Set(event.bookedSeats || []);

  grid.innerHTML = Array.from({ length: event.totalSeats }, (_, index) => {
    const seat = `S${index + 1}`;
    const disabled = booked.has(seat);

    return `
      <button class="seat ${disabled ? "booked" : ""}"
        ${disabled ? "disabled" : ""}
        data-seat="${seat}"
        onclick="toggleSeat('${seat}')">
        ${index + 1}
      </button>
    `;
  }).join("");

  updateSeatSummary();
  modal.classList.remove("hidden");
}

function closeSeatPicker() {
  document.getElementById("seat-modal")?.classList.add("hidden");
}

function toggleSeat(seat) {
  if (state.selectedSeats.has(seat)) state.selectedSeats.delete(seat);
  else state.selectedSeats.add(seat);

  document.querySelectorAll(`[data-seat="${seat}"]`).forEach((button) => {
    button.classList.toggle("selected", state.selectedSeats.has(seat));
  });

  updateSeatSummary();
}

function updateSeatSummary() {
  const count = state.selectedSeats.size;
  const price = state.selectedEvent ? count * Number(state.selectedEvent.price) : 0;

  const countEl = document.getElementById("selected-count");
  const priceEl = document.getElementById("selected-price");

  if (countEl) countEl.textContent = String(count);
  if (priceEl) priceEl.textContent = `₹${price}`;
}

async function confirmBooking() {
  if (!state.user) {
    closeSeatPicker();
    showAuth("login");
    showToast("Please login before booking.", "error");
    return;
  }

  if (!state.selectedEvent || state.selectedSeats.size === 0) {
    showToast("Select at least one seat.", "error");
    return;
  }

  const bookBtn = document.querySelector("#seat-modal .seat-summary button");
  if (bookBtn) bookBtn.disabled = true;

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        eventId: state.selectedEvent.id,
        seats: [...state.selectedSeats]
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Booking failed.");
    }

    closeSeatPicker();
    await loadEvents();
    await loadMyBookings();

    showToast(`Booking confirmed. Seats: ${data.booking.seats.join(", ")}`);
  } catch (error) {
    if (error.message.toLowerCase().includes("session")) {
      clearSession();
      updateAuthUI();
      showAuth("login");
    }
    showToast(error.message, "error");
  } finally {
    if (bookBtn) bookBtn.disabled = false;
  }
}
