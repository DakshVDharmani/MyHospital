const mongoose = require("mongoose");

/**
 * Connects to MongoDB (Atlas in the cloud, or a local mongod in dev).
 * If MONGODB_URI is unset the appointments API is simply disabled — the
 * voice endpoints keep working, so the server still boots.
 */
async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("  ⚠  MONGODB_URI not set — /api/appointments disabled");
    return false;
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || "myhospital",
    serverSelectionTimeoutMS: 8000,
  });
  console.log("  ✔  MongoDB connected");
  return true;
}

module.exports = { connectMongo, mongoose };
