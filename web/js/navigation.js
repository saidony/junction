/* ============================================================
   navigation.js
   Handles switching between the pages of the Junction app.
   ============================================================ */

function showPage(pg) {

    // Hide every page
    document.querySelectorAll('.page').forEach(function (page) {
        page.classList.remove('active');
    });

    // Remove active state from navigation links
    document.querySelectorAll('.nav-links a').forEach(function (link) {
        link.classList.remove('active');
    });

    // Find the requested page
    const targetPage = document.getElementById('page-' + pg);

    // Show the requested page
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Find matching navigation button
    const navLink = document.getElementById('nav-' + pg);

    // Highlight navigation button
    if (navLink) {
        navLink.classList.add('active');
    }

    // Go to top
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    // Render events when opening Explore Events
    if (pg === 'services') {
        if (typeof renderServices === 'function') {
            renderServices('all');
        }
    }

    // Render bookings when opening My Bookings
    if (pg === 'bookings') {
        if (typeof renderBookings === 'function') {
            renderBookings();
        }
    }
}


/* ============================================================
   LOGIN
   ============================================================ */

function showLogin(tab) {

    showPage('login');

    if (typeof switchTab === 'function') {
        switchTab(tab);
    }
}


/* ============================================================
   LOGIN REQUIRED
   ============================================================ */

function showLoginRequired() {

    if (!currentUser) {

        if (typeof showToast === 'function') {
            showToast('Please log in to book a seat');
        }

        showLogin('login');
        return;
    }

    showPage('services');
}


/* ============================================================
   INITIAL PAGE
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // Start on Home
    showPage('home');

});