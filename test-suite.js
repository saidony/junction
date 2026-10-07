/**
 * Automated End-to-End Verification Test Suite for Junction Backend
 */
const BASE_URL = "http://localhost:5000";

async function runTests() {
  console.log("🧪 Starting Automated API Test Suite...\n");
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   ${err.message}`);
      failed++;
    }
  }

  let authToken = "";
  let testUserId = "";
  let firstEventId = "";
  let createdBookingId = "";
  const testEmail = `testuser_${Date.now()}@example.com`;

  // 1. Health check
  await test("GET /api/health returns database: connected", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success || data.database !== "connected") {
      throw new Error(`Unexpected payload: ${JSON.stringify(data)}`);
    }
  });

  // 2. Public config
  await test("GET /api/config returns config object", async () => {
    const res = await fetch(`${BASE_URL}/api/config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success !== true) throw new Error("Expected success: true");
  });

  // 3. Static frontend root
  await test("GET / serves index.html", async () => {
    const res = await fetch(`${BASE_URL}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes("Junction")) throw new Error("Expected HTML to contain 'Junction'");
  });

  // 4. Static frontend css
  await test("GET /css/style.css serves stylesheet", async () => {
    const res = await fetch(`${BASE_URL}/css/style.css`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const css = await res.text();
    if (!css.includes(":root")) throw new Error("Expected valid CSS");
  });

  // 5. Fetch Events
  await test("GET /api/events returns seeded events array with id and seat counts", async () => {
    const res = await fetch(`${BASE_URL}/api/events`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.events) || data.events.length === 0) {
      throw new Error("No events returned");
    }
    const ev = data.events[0];
    if (!ev.id || !ev.title || typeof ev.availableSeats !== "number") {
      throw new Error(`Malformed event: ${JSON.stringify(ev)}`);
    }
    firstEventId = ev.id;
  });

  // 6. Category filter
  await test("GET /api/events?category=Technology filters correctly", async () => {
    const res = await fetch(`${BASE_URL}/api/events?category=Technology`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.events.every((e) => e.category.toLowerCase() === "technology")) {
      throw new Error("Category filter failed");
    }
  });

  // 7. Auth: Signup
  await test("POST /api/auth/signup creates account & returns JWT", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Aarav Patel",
        email: testEmail,
        mobile: "9876543210",
        password: "securepassword123"
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token || !data.user || data.user.email !== testEmail) {
      throw new Error(`Signup failed: ${JSON.stringify(data)}`);
    }
    authToken = data.token;
    testUserId = data.user.id;
  });

  // 8. Auth: Prevent duplicate signup
  await test("POST /api/auth/signup rejects duplicate email", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Aarav Duplicate",
        email: testEmail,
        mobile: "9876543210",
        password: "securepassword123"
      })
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 9. Auth: Login
  await test("POST /api/auth/login authenticates valid user", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "securepassword123"
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token || !data.user) throw new Error("Expected token and user");
  });

  // 10. Auth: Me
  await test("GET /api/auth/me returns current session user", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.user.email !== testEmail) throw new Error("User mismatch");
  });

  // 11. Bookings: Create Booking
  let testSeat1 = "";
  let testSeat2 = "";

  await test("POST /api/bookings books valid available seats", async () => {
    const evRes = await fetch(`${BASE_URL}/api/events/${firstEventId}`);
    const evData = await evRes.json();
    const bookedSet = new Set(evData.event.bookedSeats || []);
    const available = [];
    for (let i = 1; i <= evData.event.totalSeats; i++) {
      const s = `S${i}`;
      if (!bookedSet.has(s)) available.push(s);
    }
    testSeat1 = available[0];
    testSeat2 = available[1];

    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        eventId: firstEventId,
        seats: [testSeat1, testSeat2]
      })
    });
    if (!res.ok) {
      const errBody = await res.json();
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
    }
    const data = await res.json();
    if (!data.success || !data.booking || !data.booking.id) {
      throw new Error(`Booking creation failed: ${JSON.stringify(data)}`);
    }
    createdBookingId = data.booking.id;
  });

  // 12. Bookings: Prevent double booking
  await test("POST /api/bookings rejects already booked seat", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        eventId: firstEventId,
        seats: [testSeat1] // Already booked above!
      })
    });
    if (res.status !== 409) {
      const errBody = await res.json();
      throw new Error(`Expected 409 Conflict, got ${res.status}: ${JSON.stringify(errBody)}`);
    }
  });

  // 13. Bookings: Get User Bookings
  await test("GET /api/bookings lists user bookings with event details", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.bookings) || data.bookings.length === 0) {
      throw new Error("No bookings found");
    }
    const b = data.bookings.find((item) => item.id === createdBookingId);
    if (!b || !b.event || !b.event.title) {
      throw new Error("Booking missing event populated details");
    }
  });

  // 14. Bookings: Cancel Booking
  await test("DELETE /api/bookings/:id cancels booking and releases seats", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings/${createdBookingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error("Cancel booking failed");

    // Verify seat is available again by booking it!
    const rebookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        eventId: firstEventId,
        seats: [testSeat1]
      })
    });
    if (!rebookRes.ok) {
      const err = await rebookRes.json();
      throw new Error(`Seat ${testSeat1} was not released after cancellation: ${JSON.stringify(err)}`);
    }
  });

  console.log(`\n================================`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`================================`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
