document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupEventFilters();

  renderEvents();
  renderBookings();

  navigateTo("home");
});