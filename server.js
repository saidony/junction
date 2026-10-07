const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");
const path = require("node:path");

// Fix for Node.js DNS SRV lookups on Windows networks
const DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
try {
  dns.setServers(DNS_SERVERS);
  dnsPromises.setServers(DNS_SERVERS);
} catch (e) {
  // Ignore in environments where setServers is restricted
}

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");
const { OAuth2Client } = require("google-auth-library");
const { EmbeddedDatabase } = require("./embedded-db");

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB || "junction").trim();
const JWT_SECRET = String(process.env.JWT_SECRET || "junction_super_secret_jwt_key_2026_random_secure").trim();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Junction");
  next();
});

// Serve frontend static assets from web directory
const WEB_DIR = path.resolve(__dirname, "..", "web");
app.use(express.static(WEB_DIR));

let client = null;
let db = null;
let isUsingRealMongo = false;

let users = null;
let events = null;
let speakers = null;
let bookings = null;

function isObjectId(value) {
  return ObjectId.isValid(String(value || ""));
}

function toObjectId(value) {
  if (value instanceof ObjectId) return value;
  if (isObjectId(value)) return new ObjectId(String(value));
  return String(value);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createToken(user) {
  const userId = user._id ? user._id.toString() : String(user.id);
  return jwt.sign(
    {
      id: userId,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function safeUser(user) {
  const id = user._id ? user._id.toString() : String(user.id || "");
  const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  return {
    id,
    _id: id,
    name,
    firstName: user.firstName || name.split(" ")[0] || "",
    lastName: user.lastName || name.split(" ").slice(1).join(" ") || "",
    email: user.email || "",
    mobile: user.mobile || user.phone || "",
    phone: user.phone || user.mobile || "",
    picture: user.picture || "",
    provider: user.provider || "local"
  };
}

function formatEvent(event) {
  const id = event._id ? event._id.toString() : String(event.id || "");
  const totalSeats = Number(event.totalSeats || 30);
  const bookedSeats = Array.isArray(event.bookedSeats) ? event.bookedSeats : [];
  const availableSeats = Math.max(0, totalSeats - bookedSeats.length);

  return {
    id,
    _id: id,
    title: event.title || "Untitled Event",
    description: event.description || "",
    category: event.category || "Technology",
    date: event.date || "Upcoming",
    time: event.time || "10:00 AM - 4:00 PM",
    venue: event.venue || "Hyderabad, India",
    price: Number(event.price || 0),
    totalSeats,
    bookedSeats,
    availableSeats,
    image: event.image || "",
    speakers: Array.isArray(event.speakers) ? event.speakers : []
  };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  const token = header.slice(7).trim();

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session."
    });
  }
}

function databaseRequired(req, res, next) {
  if (!db || !users || !events || !bookings) {
    return res.status(503).json({
      success: false,
      message: "Database is not initialized."
    });
  }
  return next();
}

async function seedDatabase() {
  const userCount = await users.countDocuments();
  if (userCount === 0) {
    const hashedPassword = await bcrypt.hash("password123", 10);
    await users.insertOne({
      name: "Demo User",
      firstName: "Demo",
      lastName: "User",
      email: "demo@junction.com",
      mobile: "9876543210",
      phone: "9876543210",
      password: hashedPassword,
      provider: "local",
      picture: "",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("✅ Seeded demo user (demo@junction.com / password123).");
  }

  const count = await events.countDocuments();
  if (count > 0) {
    console.log(`ℹ️ Database already has ${count} event(s). Skipping event seed.`);
    return;
  }

  console.log("🌱 Seeding initial events into database...");

  const initialEvents = [
    {
      title: "AI & GenAI Developers Summit 2026",
      description: "Hands-on architectural deep dive into agentic systems, LLM orchestration, model tuning, and production AI deployment.",
      category: "Technology",
      date: "Nov 12, 2026",
      time: "09:30 AM - 05:00 PM",
      venue: "T-Hub Phase 2, Knowledge City, Hyderabad",
      price: 499,
      totalSeats: 30,
      bookedSeats: ["S2", "S5", "S14"],
      image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop",
      speakers: [
        { name: "Dr. Ananya Roy", role: "AI Research Lead", company: "Google DeepMind" },
        { name: "Vikram Malhotra", role: "VP of Engineering", company: "Anthropic" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Fullstack Cloud & Microservices Bootcamp",
      description: "Master modern microservices, Docker orchestration, distributed caching, and zero-downtime CI/CD workflows.",
      category: "Technology",
      date: "Nov 19, 2026",
      time: "10:00 AM - 04:30 PM",
      venue: "HITEC City Convention Center, Hyderabad",
      price: 349,
      totalSeats: 25,
      bookedSeats: ["S1", "S3"],
      image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop",
      speakers: [
        { name: "Karthik Reddy", role: "Cloud Architect", company: "AWS" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Student Founders & Angel Networking 2026",
      description: "Pitch your venture to active angel investors, get real feedback from VCs, and network with ambitious student founders.",
      category: "Business",
      date: "Nov 26, 2026",
      time: "02:00 PM - 07:00 PM",
      venue: "T-Hub Auditorium, Madhapur, Hyderabad",
      price: 299,
      totalSeats: 35,
      bookedSeats: ["S4", "S7", "S11", "S12"],
      image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop",
      speakers: [
        { name: "Meera Sen", role: "Managing Partner", company: "Hyderabad Angels" },
        { name: "Rohan Varma", role: "Founder", company: "NextGen Labs" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Product-Led Growth & SaaS Scaling Masterclass",
      description: "Unpack viral loops, acquisition funnels, onboarding experiments, and unit economics that drive SaaS from $0 to $10M ARR.",
      category: "Business",
      date: "Dec 03, 2026",
      time: "10:30 AM - 03:30 PM",
      venue: "Novotel Hyderabad Convention Centre",
      price: 599,
      totalSeats: 20,
      bookedSeats: ["S10"],
      image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop",
      speakers: [
        { name: "Siddharth Nair", role: "Head of Product", company: "Freshworks" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "UI/UX & Scalable Design Systems Workshop",
      description: "Build robust token-driven design systems in Figma and code responsive, accessible web components that scale.",
      category: "Design",
      date: "Dec 10, 2026",
      time: "01:00 PM - 06:00 PM",
      venue: "Design Hive, Jubilee Hills, Hyderabad",
      price: 399,
      totalSeats: 25,
      bookedSeats: ["S6", "S9"],
      image: "https://images.unsplash.com/photo-1581291518655-9523c932deb4?w=800&auto=format&fit=crop",
      speakers: [
        { name: "Pooja Krishnan", role: "Staff Product Designer", company: "Figma Community" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Immersive 3D & Creative Web Experience",
      description: "Dive into Three.js, WebGL shaders, WebXR, and interactive animation techniques for next-generation digital products.",
      category: "Design",
      date: "Dec 17, 2026",
      time: "02:30 PM - 06:30 PM",
      venue: "Art & Tech Studio, Banjara Hills, Hyderabad",
      price: 449,
      totalSeats: 20,
      bookedSeats: [],
      image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop",
      speakers: [
        { name: "Arjun Rao", role: "Creative Technologist", company: "Awwwards Nominee" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      title: "Tech Leadership & Career Roadmap 2027",
      description: "Senior engineering managers share interview strategies, technical leadership principles, and career progression secrets.",
      category: "Other",
      date: "Dec 22, 2026",
      time: "05:00 PM - 08:30 PM",
      venue: "Gachibowli Tech Amphitheatre, Hyderabad",
      price: 199,
      totalSeats: 40,
      bookedSeats: ["S3", "S8", "S15", "S22"],
      image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop",
      speakers: [
        { name: "Harish Nambiar", role: "Director of Engineering", company: "Microsoft" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  await events.insertMany(initialEvents);
  console.log(`✅ Seeded ${initialEvents.length} events successfully.`);
}

async function checkMongoDns(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch (error) {
    throw new Error("MONGODB_URI is not a valid MongoDB connection string: " + error.message);
  }

  if (parsed.protocol !== "mongodb+srv:") return;

  try {
    const records = await dnsPromises.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
    if (!records || records.length === 0) {
      throw new Error("MongoDB SRV record returned no nodes.");
    }
    console.log(`✅ MongoDB SRV lookup succeeded (${records.length} node(s)).`);
  } catch (error) {
    throw new Error(`MongoDB SRV DNS lookup failed: ${error.message}`);
  }
}

async function connectDatabase() {
  console.log("\n======================================");
  console.log("🔄 INITIALIZING JUNCTION DATABASE");
  console.log("======================================");

  const shouldUseExternalMongo = Boolean(
    MONGODB_URI &&
    MONGODB_URI.toLowerCase() !== "memory" &&
    MONGODB_URI.toLowerCase() !== "embedded" &&
    MONGODB_URI.toLowerCase() !== "local"
  );

  if (shouldUseExternalMongo) {
    try {
      console.log(`📡 Connecting to MongoDB URI: ${MONGODB_URI.replace(/:([^:@]{3,})@/, ":***@")}`);
      await checkMongoDns(MONGODB_URI);

      client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        socketTimeoutMS: 20000,
        family: 4,
        retryReads: true,
        retryWrites: true,
        appName: "Junction"
      });

      await client.connect();
      await client.db("admin").command({ ping: 1 });
      console.log("✅ MongoClient connected and ping succeeded.");

      db = client.db(MONGODB_DB_NAME);
      users = db.collection("users");
      events = db.collection("events");
      speakers = db.collection("speakers");
      bookings = db.collection("bookings");

      await users.createIndex({ email: 1 }, { unique: true });
      await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
      await events.createIndex({ category: 1, date: 1 });
      await bookings.createIndex({ userId: 1, createdAt: -1 });
      await bookings.createIndex({ eventId: 1, status: 1 });

      isUsingRealMongo = true;
      console.log(`✅ MongoDB connected: Database "${db.databaseName}" active.`);
      await seedDatabase();
      return;
    } catch (error) {
      console.warn("\n⚠️ Connection to configured MongoDB failed:", error.message);
      console.log("🔄 Falling back seamlessly to Built-in Local MongoDB Database...\n");
    }
  }

  // Built-in Embedded MongoDB Database
  console.log("==============================================================");
  console.log("🍃 JUNCTION BUILT-IN LOCAL MONGODB DATABASE ACTIVE");
  console.log("📁 Data is persistent at: server/data/junction_db.json");
  console.log("💡 To use MongoDB Atlas or local MongoDB service instead,");
  console.log("   set MONGODB_URI in server/.env");
  console.log("==============================================================");

  const embeddedDb = new EmbeddedDatabase(MONGODB_DB_NAME);
  db = embeddedDb;
  users = embeddedDb.collection("users");
  events = embeddedDb.collection("events");
  speakers = embeddedDb.collection("speakers");
  bookings = embeddedDb.collection("bookings");

  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
  await events.createIndex({ category: 1, date: 1 });
  await bookings.createIndex({ userId: 1, createdAt: -1 });
  await bookings.createIndex({ eventId: 1, status: 1 });

  isUsingRealMongo = false;
  await seedDatabase();
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Health check endpoints (supports both /api/health and /health)
const healthHandler = (req, res) => {
  res.json({
    success: true,
    database: "connected",
    dbType: isUsingRealMongo ? "mongodb" : "embedded-mongodb",
    message: isUsingRealMongo
      ? "Connected to MongoDB Server."
      : "Connected to Built-in Local MongoDB Database (auto-persisted to disk)."
  });
};
app.get("/api/health", databaseRequired, healthHandler);
app.get("/health", databaseRequired, healthHandler);

// Public Config (exposes Google Client ID to frontend dynamically)
app.get("/api/config", (req, res) => {
  res.json({
    success: true,
    googleClientId: GOOGLE_CLIENT_ID
  });
});

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------

// POST /api/auth/signup
app.post("/api/auth/signup", databaseRequired, async (req, res) => {
  try {
    const { name, email, mobile, phone, password } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ success: false, message: "Valid email address is required." });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long."
      });
    }

    const existingUser = await users.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists. Please sign in."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const trimmedName = name.trim();
    const nameParts = trimmedName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const contactPhone = (mobile || phone || "").trim();

    const newUserDoc = {
      name: trimmedName,
      firstName,
      lastName,
      email: cleanEmail,
      mobile: contactPhone,
      phone: contactPhone,
      password: hashedPassword,
      provider: "local",
      picture: "",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await users.insertOne(newUserDoc);
    newUserDoc._id = insertResult.insertedId || newUserDoc._id;

    const token = createToken(newUserDoc);
    return res.status(201).json({
      success: true,
      token,
      user: safeUser(newUserDoc),
      message: "Account created successfully."
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create account."
    });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", databaseRequired, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const user = await users.findOne({ email: cleanEmail });
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = createToken(user);
    return res.json({
      success: true,
      token,
      user: safeUser(user),
      message: "Signed in successfully."
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to log in."
    });
  }
});

// POST /api/auth/google
app.post("/api/auth/google", databaseRequired, async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required."
      });
    }

    let payload = null;

    if (googleClient && GOOGLE_CLIENT_ID) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } else {
      // Decode credential safely for development / demo mode
      payload = jwt.decode(credential);
    }

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: "Could not verify Google account details."
      });
    }

    const cleanEmail = normalizeEmail(payload.email);
    let user = await users.findOne({ email: cleanEmail });

    if (!user) {
      const newUserDoc = {
        name: payload.name || `${payload.given_name || ""} ${payload.family_name || ""}`.trim() || cleanEmail.split("@")[0],
        firstName: payload.given_name || "",
        lastName: payload.family_name || "",
        email: cleanEmail,
        googleId: payload.sub || "",
        picture: payload.picture || "",
        provider: "google",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await users.insertOne(newUserDoc);
      newUserDoc._id = result.insertedId || newUserDoc._id;
      user = newUserDoc;
    } else {
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            googleId: payload.sub || user.googleId,
            picture: payload.picture || user.picture,
            updatedAt: new Date()
          }
        }
      );
      user.picture = payload.picture || user.picture;
    }

    const token = createToken(user);
    return res.json({
      success: true,
      token,
      user: safeUser(user),
      message: "Signed in with Google successfully."
    });
  } catch (error) {
    console.error("Google auth error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Google authentication failed."
    });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", databaseRequired, authMiddleware, async (req, res) => {
  try {
    const user = await users.findOne({ _id: toObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.json({
      success: true,
      user: safeUser(user)
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve session." });
  }
});

// -------------------------------------------------------------
// EVENTS
// -------------------------------------------------------------

// GET /api/events
app.get("/api/events", databaseRequired, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};

    if (category && String(category).trim().toLowerCase() !== "all") {
      filter.category = new RegExp(`^${String(category).trim()}$`, "i");
    }

    const eventList = await events.find(filter).sort({ date: 1 }).toArray();
    const formatted = eventList.map(formatEvent);

    return res.json({
      success: true,
      events: formatted
    });
  } catch (error) {
    console.error("Get events error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to fetch events."
    });
  }
});

// GET /api/events/:id
app.get("/api/events/:id", databaseRequired, async (req, res) => {
  try {
    const event = await events.findOne({ _id: toObjectId(req.params.id) });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }
    return res.json({
      success: true,
      event: formatEvent(event)
    });
  } catch (error) {
    console.error("Get event by id error:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch event." });
  }
});

// -------------------------------------------------------------
// BOOKINGS
// -------------------------------------------------------------

// POST /api/bookings
app.post("/api/bookings", databaseRequired, authMiddleware, async (req, res) => {
  try {
    const { eventId, seats } = req.body || {};

    if (!eventId) {
      return res.status(400).json({ success: false, message: "Event ID is required." });
    }

    if (!Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one seat to book."
      });
    }

    const event = await events.findOne({ _id: toObjectId(eventId) });
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const bookedSeats = new Set(event.bookedSeats || []);
    const requestedSeats = [...new Set(seats.map(String))];

    // Check seat boundaries
    const totalSeats = Number(event.totalSeats || 30);
    for (const seat of requestedSeats) {
      const seatNum = Number(seat.replace(/^S/i, ""));
      if (isNaN(seatNum) || seatNum < 1 || seatNum > totalSeats) {
        return res.status(400).json({
          success: false,
          message: `Seat "${seat}" is invalid for this event.`
        });
      }
    }

    // Check if any seat is already booked
    const conflicts = requestedSeats.filter((seat) => bookedSeats.has(seat));
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Seat(s) ${conflicts.join(", ")} are already booked. Please pick other seats.`
      });
    }

    const total = requestedSeats.length * Number(event.price || 0);

    const bookingDoc = {
      userId: toObjectId(req.user.id),
      eventId: event._id,
      seats: requestedSeats,
      total,
      status: "confirmed",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await bookings.insertOne(bookingDoc);
    const bookingId = (insertResult.insertedId || bookingDoc._id).toString();

    // Mark seats as booked on event document
    await events.updateOne(
      { _id: event._id },
      { $addToSet: { bookedSeats: { $each: requestedSeats } } }
    );

    return res.status(201).json({
      success: true,
      message: "Booking confirmed successfully.",
      booking: {
        id: bookingId,
        _id: bookingId,
        eventId: event._id.toString(),
        seats: requestedSeats,
        total,
        status: "confirmed",
        event: {
          id: event._id.toString(),
          title: event.title,
          date: event.date,
          venue: event.venue
        },
        createdAt: bookingDoc.createdAt
      }
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to confirm booking."
    });
  }
});

// GET /api/bookings (User's bookings)
app.get("/api/bookings", databaseRequired, authMiddleware, async (req, res) => {
  try {
    const userBookings = await bookings
      .find({ userId: toObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .toArray();

    // Fetch related event details for each booking
    const formatted = await Promise.all(
      userBookings.map(async (booking) => {
        const id = booking._id ? booking._id.toString() : String(booking.id || "");
        let eventInfo = null;

        if (booking.eventId) {
          const ev = await events.findOne({ _id: toObjectId(booking.eventId) });
          if (ev) {
            eventInfo = {
              id: ev._id ? ev._id.toString() : String(ev.id || ""),
              title: ev.title || "Event",
              date: ev.date || "",
              venue: ev.venue || ""
            };
          }
        }

        return {
          id,
          _id: id,
          eventId: booking.eventId ? booking.eventId.toString() : "",
          seats: Array.isArray(booking.seats) ? booking.seats : [],
          total: Number(booking.total || 0),
          status: booking.status || "confirmed",
          event: eventInfo,
          createdAt: booking.createdAt
        };
      })
    );

    return res.json({
      success: true,
      bookings: formatted
    });
  } catch (error) {
    console.error("Get user bookings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve bookings."
    });
  }
});

// DELETE /api/bookings/:id (Cancel booking)
app.delete("/api/bookings/:id", databaseRequired, authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required." });
    }

    const booking = await bookings.findOne({
      _id: toObjectId(bookingId),
      userId: toObjectId(req.user.id)
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or not authorized to cancel."
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This booking has already been cancelled."
      });
    }

    // Mark booking as cancelled
    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: {
          status: "cancelled",
          updatedAt: new Date()
        }
      }
    );

    // Release booked seats on the event
    if (booking.eventId && Array.isArray(booking.seats) && booking.seats.length > 0) {
      await events.updateOne(
        { _id: toObjectId(booking.eventId) },
        {
          $pull: {
            bookedSeats: { $in: booking.seats }
          }
        }
      );
    }

    return res.json({
      success: true,
      message: "Booking cancelled successfully. Seats have been released."
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel booking."
    });
  }
});

// -------------------------------------------------------------
// STATIC SPA FALLBACK & 404
// -------------------------------------------------------------
app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.resolve(WEB_DIR, "index.html"));
  }
  return res.status(404).json({ success: false, message: "Endpoint not found." });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error."
  });
});

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Junction Server actively listening on port ${PORT}`);
    console.log(`🌐 Local Web URL  : http://localhost:${PORT}`);
    console.log(`🔌 API Health URL : http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}

startServer();
