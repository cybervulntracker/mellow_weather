const crypto = require("crypto");
const AuthToken = require("../models/AuthToken");
const { sha256 } = require("./crypto");

// Makes a fresh token (replacing any older one of the same kind) and returns the raw text to email.
async function createToken(userId, type, ttlMinutes) {
  const raw = crypto.randomBytes(32).toString("hex");
  await AuthToken.deleteMany({ userId, type });
  await AuthToken.create({ userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60000) });
  return raw;
}

// Uses a token up (one use only). Returns the user id, or null if wrong/expired/used.
async function consumeToken(raw, type) {
  if (!raw || typeof raw !== "string") return null;
  const doc = await AuthToken.findOneAndDelete({ tokenHash: sha256(raw), type, expiresAt: { $gt: new Date() } });
  return doc ? doc.userId : null;
}

module.exports = { createToken, consumeToken };
