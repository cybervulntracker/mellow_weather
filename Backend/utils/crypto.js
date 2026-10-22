const crypto = require("crypto");

let cachedKey = null;
const key = () => (cachedKey ??= crypto.scryptSync(process.env.SESSION_SECRET || "dev-secret", "mellow-secrets", 32));

// Reversible encryption for things we must read back later (the 2FA secret).
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("hex")).join(":");
}

function decrypt(stored) {
  const [iv, tag, data] = stored.split(":").map((h) => Buffer.from(h, "hex"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// One-way fingerprint for reset tokens and backup codes (we never store the originals).
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

module.exports = { encrypt, decrypt, sha256 };
