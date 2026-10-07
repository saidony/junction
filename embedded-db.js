const fs = require("node:fs");
const path = require("node:path");
const { ObjectId } = require("mongodb");

/**
 * High-fidelity Embedded MongoDB Engine
 * Provides MongoDB Collections interface backed by JSON file persistence.
 * Used automatically when a remote/local MongoDB server is unavailable,
 * guaranteeing zero setup friction and full offline development support.
 */

const DATA_DIR = path.resolve(__dirname, "data");
const DB_FILE = path.resolve(DATA_DIR, "junction_db.json");

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function matchValue(actual, expected) {
  if (expected === undefined) return true;

  // Handle RegExp
  if (expected instanceof RegExp) {
    return expected.test(String(actual || ""));
  }

  // Handle MongoDB ObjectId comparisons
  if (actual instanceof ObjectId || expected instanceof ObjectId) {
    return String(actual) === String(expected);
  }

  // Handle $in operator
  if (expected && typeof expected === "object" && Array.isArray(expected.$in)) {
    const expectedStrings = expected.$in.map((item) => String(item));
    return expectedStrings.includes(String(actual));
  }

  // Handle arrays in actual document
  if (Array.isArray(actual)) {
    if (Array.isArray(expected)) {
      return JSON.stringify(actual) === JSON.stringify(expected);
    }
    return actual.some((item) => String(item) === String(expected));
  }

  return actual === expected;
}

function matchDoc(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, expected] of Object.entries(filter)) {
    if (key === "_id") {
      const actualId = String(doc._id || "");
      const expectedId = String(expected || "");
      if (actualId !== expectedId) return false;
      continue;
    }

    if (key === "$or" && Array.isArray(expected)) {
      const orMatched = expected.some((subFilter) => matchDoc(doc, subFilter));
      if (!orMatched) return false;
      continue;
    }

    const actual = doc[key];
    if (!matchValue(actual, expected)) {
      return false;
    }
  }

  return true;
}

function clone(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value instanceof ObjectId) return value.toString();
    return value;
  }));
}

class EmbeddedCollection {
  constructor(name, getDocs, setDocs, persist) {
    this.name = name;
    this.getDocs = getDocs;
    this.setDocs = setDocs;
    this.persist = persist;
    this.indexes = [];
  }

  async createIndex(keys, options = {}) {
    this.indexes.push({ keys, options });
    return Object.keys(keys).join("_");
  }

  async countDocuments(filter = {}) {
    const docs = this.getDocs(this.name);
    return docs.filter((doc) => matchDoc(doc, filter)).length;
  }

  async findOne(filter = {}) {
    const docs = this.getDocs(this.name);
    const found = docs.find((doc) => matchDoc(doc, filter));
    return found ? clone(found) : null;
  }

  find(filter = {}) {
    const docs = this.getDocs(this.name);
    let matched = docs.filter((doc) => matchDoc(doc, filter)).map(clone);

    const cursor = {
      sort(sortSpec = {}) {
        const [field, direction] = Object.entries(sortSpec)[0] || [];
        if (field) {
          const dir = direction === -1 || direction === "desc" ? -1 : 1;
          matched.sort((a, b) => {
            const valA = a[field] ?? "";
            const valB = b[field] ?? "";
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
          });
        }
        return cursor;
      },
      async toArray() {
        return matched;
      }
    };

    return cursor;
  }

  async insertOne(doc) {
    const docs = this.getDocs(this.name);
    const newDoc = { ...doc };

    if (!newDoc._id) {
      newDoc._id = new ObjectId().toString();
    } else {
      newDoc._id = String(newDoc._id);
    }

    docs.push(newDoc);
    this.setDocs(this.name, docs);
    this.persist();

    return {
      acknowledged: true,
      insertedId: newDoc._id
    };
  }

  async insertMany(docsToAdd) {
    const docs = this.getDocs(this.name);
    const insertedIds = {};

    for (let i = 0; i < docsToAdd.length; i++) {
      const newDoc = { ...docsToAdd[i] };
      if (!newDoc._id) {
        newDoc._id = new ObjectId().toString();
      } else {
        newDoc._id = String(newDoc._id);
      }
      docs.push(newDoc);
      insertedIds[i] = newDoc._id;
    }

    this.setDocs(this.name, docs);
    this.persist();

    return {
      acknowledged: true,
      insertedCount: docsToAdd.length,
      insertedIds
    };
  }

  async updateOne(filter, update) {
    const docs = this.getDocs(this.name);
    const index = docs.findIndex((doc) => matchDoc(doc, filter));

    if (index === -1) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }

    const doc = { ...docs[index] };

    // Handle $set
    if (update.$set) {
      for (const [key, value] of Object.entries(update.$set)) {
        doc[key] = value;
      }
    }

    // Handle $addToSet
    if (update.$addToSet) {
      for (const [key, value] of Object.entries(update.$addToSet)) {
        if (!Array.isArray(doc[key])) {
          doc[key] = [];
        }
        if (value && typeof value === "object" && Array.isArray(value.$each)) {
          for (const item of value.$each) {
            if (!doc[key].includes(item)) {
              doc[key].push(item);
            }
          }
        } else {
          if (!doc[key].includes(value)) {
            doc[key].push(value);
          }
        }
      }
    }

    // Handle $pull
    if (update.$pull) {
      for (const [key, value] of Object.entries(update.$pull)) {
        if (Array.isArray(doc[key])) {
          if (value && typeof value === "object" && Array.isArray(value.$in)) {
            const pullItems = value.$in.map((item) => String(item));
            doc[key] = doc[key].filter((item) => !pullItems.includes(String(item)));
          } else {
            doc[key] = doc[key].filter((item) => String(item) !== String(value));
          }
        }
      }
    }

    docs[index] = doc;
    this.setDocs(this.name, docs);
    this.persist();

    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter) {
    const docs = this.getDocs(this.name);
    const index = docs.findIndex((doc) => matchDoc(doc, filter));

    if (index === -1) {
      return { acknowledged: true, deletedCount: 0 };
    }

    docs.splice(index, 1);
    this.setDocs(this.name, docs);
    this.persist();

    return { acknowledged: true, deletedCount: 1 };
  }
}

class EmbeddedDatabase {
  constructor(dbName = "junction") {
    this.databaseName = dbName;
    this.data = {
      users: [],
      events: [],
      speakers: [],
      bookings: []
    };
    this.load();
  }

  load() {
    try {
      ensureDirectoryExists(DATA_DIR);
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          events: parsed.events || [],
          speakers: parsed.speakers || [],
          bookings: parsed.bookings || []
        };
      } else {
        this.save();
      }
    } catch (err) {
      console.warn("⚠️ Failed to load existing embedded DB file; starting fresh.", err.message);
    }
  }

  save() {
    try {
      ensureDirectoryExists(DATA_DIR);
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf8");
    } catch (err) {
      console.error("❌ Failed to persist embedded database:", err.message);
    }
  }

  collection(name) {
    if (!this.data[name]) {
      this.data[name] = [];
    }

    return new EmbeddedCollection(
      name,
      (colName) => this.data[colName],
      (colName, docs) => {
        this.data[colName] = docs;
      },
      () => this.save()
    );
  }

  async command(cmd) {
    if (cmd && cmd.ping) {
      return { ok: 1 };
    }
    return { ok: 1 };
  }
}

module.exports = {
  EmbeddedDatabase,
  DB_FILE,
  DATA_DIR
};
