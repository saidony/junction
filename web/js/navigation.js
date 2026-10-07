function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function showBookings() {
  if (!state.user) {
    showAuth("login");
    return;
  }

  scrollToSection("bookings-section");
  loadMyBookings();
}
