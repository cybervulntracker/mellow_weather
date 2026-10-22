const mongoose = require("mongoose");

// The in-app inbox (bell icon). Text is stored as { key, params } so the
// browser can show it in the person's language.
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["digest", "rain", "rule", "support"], required: true },
    dedupeKey: { type: String, required: true },
    place: { type: String, default: "" },
    title: { key: String, params: mongoose.Schema.Types.Mixed },
    lines: [{ key: String, params: mongoose.Schema.Types.Mixed }],
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
