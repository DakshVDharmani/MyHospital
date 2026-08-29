const express = require("express");
const Appointment = require("../models/Appointment");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth); // every appointments route needs a signed-in user

const DUR_MS = 30 * 60 * 1000;
const asMode = (m) => (m === "video" ? "video" : "in_person");

/* ------------------------------------------------------------------ *
 *  GET /api/appointments?from=<iso>&to=<iso>
 *  Both parties see the same shared records.
 * ------------------------------------------------------------------ */
router.get("/", async (req, res, next) => {
  try {
    const { id } = req.user;
    const q = { $or: [{ doctorId: id }, { patientId: id }] };
    if (req.query.from || req.query.to) {
      q.start = {};
      if (req.query.from) q.start.$gte = new Date(req.query.from);
      if (req.query.to) q.start.$lte = new Date(req.query.to);
    }
    const rows = await Appointment.find(q).sort({ start: 1 }).limit(500);
    res.json(rows.map((r) => r.toClient()));
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ *
 *  POST /api/appointments/request        (PATIENT only)
 *  Creates a pending request the doctor will later confirm.
 * ------------------------------------------------------------------ */
router.post("/request", requireRole("patient"), async (req, res, next) => {
  try {
    const { doctorId, doctorName, title, reason, mode, start, end, preferredWindow } = req.body;
    if (!doctorId || !title) {
      return res.status(400).json({ error: "doctorId and title are required" });
    }
    const startAt = start ? new Date(start) : new Date();
    const doc = await Appointment.create({
      doctorId,
      doctorName: doctorName || "",
      patientId: req.user.id,
      patientName: req.user.name || "",
      title,
      reason: reason || "",
      mode: asMode(mode),
      start: startAt,
      end: end ? new Date(end) : new Date(startAt.getTime() + DUR_MS),
      status: "requested",
      requestedBy: "patient",
      preferredWindow: preferredWindow || "",
    });
    res.status(201).json(doc.toClient());
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ *
 *  POST /api/appointments                (DOCTOR only)
 *  Doctor schedules directly on their calendar — immediately confirmed.
 * ------------------------------------------------------------------ */
router.post("/", requireRole("doctor"), async (req, res, next) => {
  try {
    const { patientId, patientName, title, reason, mode, start, end, location } = req.body;
    if (!patientId || !title || !start || !end) {
      return res.status(400).json({ error: "patientId, title, start and end are required" });
    }
    const doc = await Appointment.create({
      doctorId: req.user.id,
      doctorName: req.user.name || "",
      patientId,
      patientName: patientName || "",
      title,
      reason: reason || "",
      mode: asMode(mode),
      start: new Date(start),
      end: new Date(end),
      location: location || "",
      status: "confirmed",
      requestedBy: "doctor",
    });
    res.status(201).json(doc.toClient());
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ *
 *  PATCH /api/appointments/:id           (DOCTOR only)
 *  Confirm a request, reschedule, change mode/location, add notes,
 *  decline or mark complete.
 * ------------------------------------------------------------------ */
router.patch("/:id", requireRole("doctor"), async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (appt.doctorId !== req.user.id) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    const f = req.body;
    if (f.start) appt.start = new Date(f.start);
    if (f.end) appt.end = new Date(f.end);
    if (typeof f.title === "string") appt.title = f.title;
    if (typeof f.reason === "string") appt.reason = f.reason;
    if (typeof f.location === "string") appt.location = f.location;
    if (typeof f.notes === "string") appt.notes = f.notes;
    if (f.mode) appt.mode = asMode(f.mode);
    if (
      f.status &&
      ["requested", "confirmed", "declined", "cancelled", "completed"].includes(f.status)
    ) {
      appt.status = f.status;
    }
    await appt.save();
    res.json(appt.toClient());
  } catch (e) {
    next(e);
  }
});

/* ------------------------------------------------------------------ *
 *  PATCH /api/appointments/:id/cancel    (either party)
 *  A patient may only cancel their own still-pending request; a doctor
 *  may cancel any of their appointments.
 * ------------------------------------------------------------------ */
router.patch("/:id/cancel", async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const mine = appt.patientId === req.user.id || appt.doctorId === req.user.id;
    if (!mine) return res.status(403).json({ error: "Not your appointment" });
    if (req.user.role === "patient" && appt.status !== "requested") {
      return res
        .status(403)
        .json({ error: "Only a pending request can be cancelled by the patient" });
    }
    appt.status = "cancelled";
    await appt.save();
    res.json(appt.toClient());
  } catch (e) {
    next(e);
  }
});

module.exports = router;
