const mongoose = require("mongoose");

// One document per login. Updated by heartbeats while the user is really
// using the site, so "active time" is measured, not guessed.
const userSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endReason: { type: String, enum: ["logout", "expired", "revoked", null], default: null },
    sid: { type: String, default: "" }, // express-session id, so a device can be signed out remotely
    currentPage: { type: String, default: "" },
    activeSeconds: { type: Number, default: 0 },
    actions: { type: Number, default: 0 },
    ip: { type: String, default: "" },
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    device: { type: String, default: "" },
  },
  { timestamps: true }
);

userSessionSchema.index({ startedAt: -1 });

module.exports = mongoose.model("UserSession", userSessionSchema);
