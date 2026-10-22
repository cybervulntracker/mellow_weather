const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const argon2 = require("argon2");
const QRCode = require("qrcode");
const User = require("../models/Users");
const UserSession = require("../models/UserSession");
const UserActivity = require("../models/UserActivity");
const ActivityLog = require("../models/ActivityLog");
const Favorite = require("../models/Favorite");
const SearchHistory = require("../models/SearchHistory");
const AlertRule = require("../models/AlertRule");
const Notification = require("../models/Notification");
const requireAuth = require("../middleware/requireAuth");
const track = require("../utils/track");
const logActivity = require("../utils/logActivity");
const { revokeSessions, destroyInStore } = require("../utils/sessions");
const { deleteUserData } = require("../utils/accountCleanup");
const { encrypt, decrypt, sha256 } = require("../utils/crypto");
const { generateSecret, verifyTotp, otpauthUri } = require("../utils/totp");

const router = express.Router();
router.use(requireAuth);

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // matches the cookie in app.js

/* ---------------- signed-in devices ---------------- */

router.get("/devices", async (req, res) => {
  try {
    const sessions = await UserSession.find({ userId: req.user._id, endedAt: null, startedAt: { $gte: new Date(Date.now() - SESSION_LIFETIME_MS) } })
      .sort({ startedAt: -1 }).lean();
    res.json(sessions.map((s) => ({
      _id: s._id, browser: s.browser, os: s.os, device: s.device, ip: s.ip,
      startedAt: s.startedAt, lastSeenAt: s.lastSeenAt, current: s.sid === req.sessionID,
    })));
  } catch (error) {
    console.error("DEVICES ERROR:", error);
    res.status(500).json({ message: "Failed to load devices" });
  }
});

router.post("/devices/revoke-others", async (req, res) => {
  try {
    const count = await revokeSessions(req.sessionStore, req.user._id, req.sessionID);
    await track(req, { action: "account.devices_revoked", description: `Signed out ${count} other device(s)`, count: false });
    res.json({ revoked: count });
  } catch (error) {
    console.error("REVOKE OTHERS ERROR:", error);
    res.status(500).json({ message: "Failed to sign out other devices" });
  }
});

router.delete("/devices/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Device not found" });
    const session = await UserSession.findOne({ _id: req.params.id, userId: req.user._id, endedAt: null });
    if (!session) return res.status(404).json({ message: "Device not found" });
    if (session.sid === req.sessionID) return res.status(400).json({ message: "Use “Sign out” to leave this device." });

    if (session.sid) await destroyInStore(req.sessionStore, session.sid);
    session.endedAt = new Date();
    session.endReason = "revoked";
    await session.save();
    await track(req, { action: "account.device_revoked", description: `Signed out a device (${session.browser} on ${session.os})`, count: false });
    res.json({ message: "Device signed out" });
  } catch (error) {
    console.error("REVOKE DEVICE ERROR:", error);
    res.status(500).json({ message: "Failed to sign out the device" });
  }
});

/* ---------------- download my data / delete my account ---------------- */

router.get("/export", async (req, res) => {
  try {
    const userId = req.user._id;
    const [favorites, history, rules, notifications, activity, sessions, summary] = await Promise.all([
      Favorite.find({ userId }).lean(),
      SearchHistory.find({ userId }).lean(),
      AlertRule.find({ userId }).lean(),
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
      ActivityLog.find({ actorId: userId }).sort({ occurredAt: -1 }).limit(1000).lean(),
      UserSession.find({ userId }).sort({ startedAt: -1 }).limit(50).select("-sid").lean(),
      UserActivity.findOne({ userId }).lean(),
    ]);
    await track(req, { action: "account.data_exported", description: "Downloaded a copy of their data", count: false });

    res.set({ "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="mellowweather-my-data.json"' });
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), profile: req.user.toPublic(), usage: summary, favorites, searchHistory: history, alertRules: rules, notifications, activity, sessions }, null, 2));
  } catch (error) {
    console.error("EXPORT ERROR:", error);
    res.status(500).json({ message: "Failed to export your data" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.passwordSet) {
      if (!(await argon2.verify(user.password, String(req.body.password || "")))) {
        return res.status(400).json({ message: "Password is incorrect" });
      }
    } else if (req.body.confirm !== "DELETE") {
      return res.status(400).json({ message: "Type DELETE to confirm" });
    }
    if (user.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
      return res.status(400).json({ message: "You are the only administrator. Make someone else an admin first." });
    }

    await revokeSessions(req.sessionStore, user._id, req.sessionID);
    await deleteUserData(user._id);
    // remove their log entries, then leave a single anonymous audit line
    await ActivityLog.deleteMany({ actorId: user._id });
    await logActivity({ actorId: user._id, actorRole: user.role, action: "account.self_deleted", description: `Account ${user.email} was deleted by its owner`, targetLabel: user.email });

    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Your account has been deleted." });
    });
  } catch (error) {
    console.error("DELETE ACCOUNT ERROR:", error);
    res.status(500).json({ message: "Failed to delete your account" });
  }
});

/* ---------------- two-factor authentication ---------------- */

router.post("/2fa/setup", async (req, res) => {
  try {
    if (req.user.twoFactorEnabled) return res.status(400).json({ message: "Two-factor sign-in is already on." });
    const secret = generateSecret();
    await User.updateOne({ _id: req.user._id }, { $set: { twoFactorPending: encrypt(secret) } });
    const uri = otpauthUri(secret, req.user.email, "MellowWeather");
    res.json({ secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
  } catch (error) {
    console.error("2FA SETUP ERROR:", error);
    res.status(500).json({ message: "Failed to start setup" });
  }
});

router.post("/2fa/enable", async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+twoFactorPending");
    if (!user.twoFactorPending) return res.status(400).json({ message: "Start the setup first." });

    const secret = decrypt(user.twoFactorPending);
    const step = verifyTotp(secret, req.body.code);
    if (!step) return res.status(400).json({ message: "That code isn't right. Check the app and try again." });

    // 8 one-time backup codes, shown once; only their hashes are stored
    const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex"));
    user.twoFactorSecret = user.twoFactorPending;
    user.twoFactorPending = undefined;
    user.twoFactorBackup = codes.map((c) => sha256(c));
    user.twoFactorEnabled = true;
    user.twoFactorLastStep = step;
    await user.save();

    await track(req, { action: "account.2fa_enabled", description: "Turned on two-factor sign-in", count: false });
    res.json({ backupCodes: codes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`) });
  } catch (error) {
    console.error("2FA ENABLE ERROR:", error);
    res.status(500).json({ message: "Failed to turn on two-factor sign-in" });
  }
});

router.post("/2fa/disable", async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+twoFactorSecret");
    if (!user.twoFactorEnabled) return res.status(400).json({ message: "Two-factor sign-in is not on." });

    // password if they have one, otherwise a current code from the app
    const allowed = user.passwordSet
      ? await argon2.verify(user.password, String(req.body.password || ""))
      : Boolean(verifyTotp(decrypt(user.twoFactorSecret), req.body.code));
    if (!allowed) return res.status(400).json({ message: user.passwordSet ? "Password is incorrect" : "That code isn't right" });

    await User.updateOne({ _id: user._id }, { $set: { twoFactorEnabled: false, twoFactorBackup: [], twoFactorLastStep: 0 }, $unset: { twoFactorSecret: 1, twoFactorPending: 1 } });
    await track(req, { action: "account.2fa_disabled", description: "Turned off two-factor sign-in", count: false });
    res.json({ message: "Two-factor sign-in is off." });
  } catch (error) {
    console.error("2FA DISABLE ERROR:", error);
    res.status(500).json({ message: "Failed to turn off two-factor sign-in" });
  }
});

module.exports = router;
