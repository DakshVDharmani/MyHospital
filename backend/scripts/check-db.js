/**
 * Verifies the MongoDB connection and shows what's in the appointments DB.
 *   node scripts/check-db.js
 */
require("dotenv").config();
const { connectMongo, mongoose } = require("../db");
const Appointment = require("../models/Appointment");

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error("✖  MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }
  try {
    await connectMongo();
    await Appointment.syncIndexes(); // ensure the schema's indexes exist

    const total = await Appointment.countDocuments();
    const byStatus = await Appointment.aggregate([
      { $group: { _id: "$status", n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const indexes = await Appointment.collection.indexes();

    console.log(`\n✔  Connected to "${mongoose.connection.name}"`);
    console.log(`   appointments: ${total} document(s)`);
    byStatus.forEach((s) => console.log(`     • ${s._id}: ${s.n}`));
    console.log(`   indexes: ${indexes.map((i) => i.name).join(", ")}\n`);
  } catch (e) {
    console.error("✖  Connection failed:", e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
