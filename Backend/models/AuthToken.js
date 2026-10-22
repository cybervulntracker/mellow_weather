const mongoose = require("mongoose");

// Single-use links sent by email: "reset your password" and "verify your email".
// Only a hash of the token is stored, so a database leak can't be used to reset accounts.
const authTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["reset", "verify"], required: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
});

module.exports = mongoose.model("AuthToken", authTokenSchema);
