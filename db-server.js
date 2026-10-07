require("dotenv").config();
const { MongoClient } = require("mongodb");
const { EmbeddedDatabase, DB_FILE } = require("./embedded-db");
const fs = require("node:fs");

const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB || "junction").trim();

async function checkDatabase() {
  console.log("==================================================");
  console.log("🍃 JUNCTION MONGODB SERVER & STORAGE MANAGER");
  console.log("==================================================");
  console.log(`Configured MONGODB_URI : ${MONGODB_URI || "(None provided; using Embedded Database)"}`);
  console.log(`Database Name          : ${MONGODB_DB_NAME}`);
  console.log(`Embedded Storage File  : ${DB_FILE}`);
  console.log("--------------------------------------------------");

  let connectedRealMongo = false;
  if (MONGODB_URI) {
    try {
      console.log("🔄 Testing connection to configured MongoDB URI...");
      const client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000
      });
      await client.connect();
      const pingRes = await client.db(MONGODB_DB_NAME).command({ ping: 1 });
      console.log("✅ Successfully connected to MongoDB Server!");
      console.log(`   Ping Result: ${JSON.stringify(pingRes)}`);

      const db = client.db(MONGODB_DB_NAME);
      const cols = await db.listCollections().toArray();
      console.log(`   Existing collections (${cols.length}): ${cols.map((c) => c.name).join(", ") || "none"}`);

      for (const col of cols) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`   • ${col.name.padEnd(12)} : ${count} document(s)`);
      }

      await client.close();
      connectedRealMongo = true;
    } catch (err) {
      console.log("⚠️ Could not connect to external/local MongoDB instance:");
      console.log(`   Error: ${err.message}`);
      console.log("   (The server will automatically use the Built-in Embedded Database)");
    }
  }

  if (!connectedRealMongo) {
    console.log("");
    console.log("📦 Checking Built-in Embedded MongoDB Database:");
    const embeddedDb = new EmbeddedDatabase(MONGODB_DB_NAME);
    const collections = ["users", "events", "bookings", "speakers"];
    for (const name of collections) {
      const col = embeddedDb.collection(name);
      const count = await col.countDocuments();
      console.log(`   • ${name.padEnd(12)} : ${count} document(s)`);
    }
    console.log(`   File exists on disk: ${fs.existsSync(DB_FILE) ? "Yes" : "Not yet (created on first write)"}`);
  }

  console.log("==================================================");
}

checkDatabase().catch(console.error);
