/**
 * Seeds a handful of appointments so the calendar isn't empty during a demo.
 *
 *   node scripts/seed.js --doctor <uuid> --patient <uuid> \
 *        [--doctorName "Dr. Anjali Rao"] [--patientName "Ravi Kumar"] [--wipe]
 *
 * The uuids are Supabase auth user ids — copy them from
 * Supabase → Authentication → Users, or from public.users.
 * Env fallbacks: SEED_DOCTOR_ID, SEED_PATIENT_ID.
 */
require("dotenv").config();
const { connectMongo, mongoose } = require("../db");
const Appointment = require("../models/Appointment");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const doctorId = arg("doctor", process.env.SEED_DOCTOR_ID);
const patientId = arg("patient", process.env.SEED_PATIENT_ID);
const doctorName = arg("doctorName", "Dr. Anjali Rao");
const patientName = arg("patientName", "Ravi Kumar");
const wipe = process.argv.includes("--wipe");

if (!doctorId || !patientId) {
  console.error("✖  Need --doctor <uuid> and --patient <uuid> (or SEED_DOCTOR_ID / SEED_PATIENT_ID).");
  process.exit(1);
}

// helper: a Date N days from now at HH:MM local
const at = (days, hh, mm = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hh, mm, 0, 0);
  return d;
};
const plus = (date, mins) => new Date(date.getTime() + mins * 60000);

const base = { doctorId, patientId, doctorName, patientName };
const samples = [
  { ...base, title: "Chest pain follow-up", reason: "Reviewing ECG + meds", mode: "in_person",
    start: at(0, 11, 0), end: at(0, 11, 30), status: "confirmed", requestedBy: "doctor" },
  { ...base, title: "Medication review", reason: "BP trending high", mode: "video",
    start: at(1, 9, 30), end: at(1, 10, 0), status: "confirmed", requestedBy: "doctor" },
  { ...base, title: "New symptom — headaches", reason: "4 days, worse in the morning", mode: "video",
    start: at(2, 15, 0), end: at(2, 15, 30), status: "requested", requestedBy: "patient",
    preferredWindow: "Any weekday afternoon" },
  { ...base, title: "Post-op wound check", reason: "", mode: "in_person",
    start: at(-3, 10, 0), end: at(-3, 10, 30), status: "completed", requestedBy: "doctor" },
];

(async () => {
  try {
    await connectMongo();
    if (wipe) {
      const { deletedCount } = await Appointment.deleteMany({ $or: [{ doctorId }, { patientId }] });
      console.log(`   wiped ${deletedCount} existing doc(s) for this pair`);
    }
    const docs = await Appointment.insertMany(
      samples.map((s) => ({
        ...s,
        start: plus(s.start, 0),
        end: s.end,
      })),
    );
    console.log(`\n✔  Inserted ${docs.length} appointment(s):`);
    docs.forEach((d) => console.log(`     • ${d.status.padEnd(9)} ${d.start.toLocaleString()}  ${d.title}`));
    console.log("");
  } catch (e) {
    console.error("✖  Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
