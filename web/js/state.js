const state = {
  currentUser: null,
  currentPage: 'home',
  selectedEvent: null,
  bookings: [],
  events: [],
  speakers: []
};

function setCurrentUser(user) {
  state.currentUser = user;
}

function getCurrentUser() {
  return state.currentUser;
}

function setCurrentPage(page) {
  state.currentPage = page;
}

function getCurrentPage() {
  return state.currentPage;
}

function setSelectedEvent(event) {
  state.selectedEvent = event;
}

function getSelectedEvent() {
  return state.selectedEvent;
}