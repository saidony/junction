# Junction

Junction is a modern event discovery and seat booking platform built for students and professionals.

---

## Project Structure

```
junction/
├── docker-compose.yml       # Optional: Docker config for local MongoDB 7.0 + Mongo Express GUI
├── server/
│   ├── data/
│   │   └── junction_db.json # Auto-persisted local database (zero setup required)
│   ├── embedded-db.js       # Built-in Embedded MongoDB Engine
│   ├── db-server.js         # Database manager & connection inspector CLI
│   ├── test-suite.js        # Automated API test suite (14/14 tests)
│   ├── server.js            # Express API + MongoDB + Auth + Bookings + Static Hosting
│   ├── .env                 # Active environment variables
│   ├── .env.example         # Environment template
│   └── package.json         # Server scripts and dependencies
└── web/
    ├── index.html           # Single-page web application
    ├── css/
    │   └── style.css        # Clean responsive styles
    └── js/
        ├── state.js         # Client-side session and event state
        ├── data.js          # Event categories
        ├── navigation.js    # Smooth navigation & bookings view
        ├── auth.js          # Sign In, Sign Up, Google OAuth, Session restore
        ├── events.js        # Event card rendering & category filtering
        ├── booking.js       # Interactive seat grid & booking confirmation
        ├── bookings.js      # User bookings view & booking cancellation
        └── main.js          # App boot, live DB status indicator, dynamic config
```

---

## Quick Start (Zero Setup Required)

The backend includes an **automatic Built-in Local MongoDB Database Engine**. You do not need to install MongoDB or set up Atlas to run the app immediately.

1. Open your terminal in `server/`:
   ```powershell
   cd server
   npm start
   ```

2. Open your browser:
   ```
   http://localhost:5000
   ```

The web app is hosted directly by the Express server on port `5000`.

---

## Demo Account

A demo user is automatically pre-seeded in the database:

- **Email**: `demo@junction.com`
- **Password**: `password123`

You can also create a new account using the **Create Account** button.

---

## MongoDB Options

Junction supports three database setups seamlessly:

### 1. Built-in Local MongoDB (Default)
- No installation needed.
- Data automatically persists to `server/data/junction_db.json`.
- Full support for users, events, seat reservations, and booking cancellations.

### 2. MongoDB Atlas (Cloud)
1. Open `server/.env`.
2. Set your Atlas connection string in `MONGODB_URI`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/junction?retryWrites=true&w=majority
   ```
3. Restart the server (`npm start`). The server automatically performs DNS SRV resolution and connects to Atlas.

### 3. Local MongoDB with Docker
Run official MongoDB 7.0 and the Mongo Express web UI with one command:
```powershell
docker compose up -d
```
- MongoDB Server: `mongodb://localhost:27017/junction`
- Mongo Express Web GUI: `http://localhost:8081`

---

## Useful Commands

From the `server/` directory:

| Command | Description |
|---|---|
| `npm start` | Start the Express server + MongoDB |
| `npm run dev` | Start the server in watch mode (auto-restarts on edits) |
| `npm run db` | Inspect database status, collections, and document counts |
| `npm test` | Run the automated 14-test end-to-end API test suite |

---

## Google Sign-In (Optional)

1. Put your Google OAuth Web Client ID in `server/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```
2. The frontend automatically discovers this ID via `/api/config` and enables the **Sign in with Google** button.
