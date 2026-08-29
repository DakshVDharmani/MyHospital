const { mongoose } = require("../db");
const { Schema } = mongoose;

/**
 * One appointment, shared between a doctor and a patient.
 *
 * Visibility  : both parties can read it (enforced in the route by matching
 *               the verified user id against doctorId / patientId).
 * Mutation    : only the doctor can confirm / reschedule / decline / annotate.
 *               A patient can only create a `requested` row and cancel their
 *               own still-pending request.
 */
const AppointmentSchema = new Schema(
  {
    doctorId: { type: String, required: true, index: true }, // Supabase auth uid
    patientId: { type: String, required: true, index: true }, // Supabase auth uid
    doctorName: { type: String, default: "" }, // denormalised for standalone display
    patientName: { type: String, default: "" },

    title: { type: String, required: true, trim: true, maxlength: 140 },
    reason: { type: String, default: "", maxlength: 2000 },

    start: { type: Date, required: true },
    end: { type: Date, required: true },

    mode: { type: String, enum: ["in_person", "video"], default: "in_person" },
    location: { type: String, default: "" },

    status: {
      type: String,
      enum: ["requested", "confirmed", "declined", "cancelled", "completed"],
      default: "requested",
      index: true,
    },
    requestedBy: { type: String, enum: ["patient", "doctor"], required: true },

    /** Patient's free-text preference when they don't pin an exact slot. */
    preferredWindow: { type: String, default: "" },
    /** Doctor-only private note; never shown to the patient by the client. */
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

AppointmentSchema.index({ doctorId: 1, start: 1 });
AppointmentSchema.index({ patientId: 1, start: 1 });

/** Shape returned to the client. */
AppointmentSchema.methods.toClient = function toClient() {
  return {
    id: String(this._id),
    doctorId: this.doctorId,
    patientId: this.patientId,
    doctorName: this.doctorName,
    patientName: this.patientName,
    title: this.title,
    reason: this.reason,
    start: this.start.toISOString(),
    end: this.end.toISOString(),
    mode: this.mode,
    location: this.location,
    status: this.status,
    requestedBy: this.requestedBy,
    preferredWindow: this.preferredWindow,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("Appointment", AppointmentSchema);
