const express = require("express");
const mongoose = require("mongoose");
const argon2 = require("argon2");
const User = require("../models/Users");
const UserActivity = require("../models/UserActivity");
const UserSession = require("../models/UserSession");
const DailyUsage = require("../models/DailyUsage");
const ActivityLog = require("../models/ActivityLog");
const requireAuth = require("../middleware/requireAuth");
const track = require("../utils/track");
const { revokeSessions } = require("../utils/sessions");

const { PREF_OPTIONS } = User;

const router = express.Router();

const MAX_AVATAR_BYTES = 1024 * 1024; // 1 MB after decoding (the browser sends ~30 KB)

// Real image files start with known bytes; refuse anything else.
function detectImageType(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// ---- Current user: profile + personal stats -------------------------------
router.get("/me", requireAuth, async (req, res) => {
  try {
    const [activity, daily] = await Promise.all([
      UserActivity.findOne({ userId: req.user._id }).lean(),
      DailyUsage.find({ userId: req.user._id }).sort({ date: -1 }).limit(14).select("date activeSeconds actions -_id").lean(),
    ]);
    res.json({
      user: req.user.toPublic(),
      stats: {
        totalActiveSeconds: activity?.totalActiveSeconds || 0,
        totalActions: activity?.totalActions || 0,
        totalSessions: activity?.totalSessions || 0,
        actionCounts: activity?.actionCounts || {},
        dailyUsage: daily.reverse(),
      },
    });
  } catch (error) {
    console.error("GET /users/me ERROR:", error);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const profileChanges = {};
    const prefChanges = [];
    let unitChanged = null;

    if (req.body.username !== undefined) {
      const username = String(req.body.username).trim();
      if (!username) return res.status(400).json({ message: "Name cannot be empty" });
      if (username.length > 60) return res.status(400).json({ message: "Name is too long" });
      if (username !== user.username) { profileChanges.username = [user.username, username]; user.username = username; }
    }

    if (req.body.bio !== undefined) {
      const bio = String(req.body.bio).trim();
      if (bio.length > 240) return res.status(400).json({ message: "Bio must be 240 characters or fewer" });
      if (bio !== user.bio) { profileChanges.bio = true; user.bio = bio; }
    }

    // units, clock, theme, language
    for (const field of Object.keys(PREF_OPTIONS)) {
      const value = req.body[field];
      if (value === undefined) continue;
      if (!PREF_OPTIONS[field].includes(value)) return res.status(400).json({ message: `Invalid ${field}` });
      if (value !== user[field]) {
        if (field === "preferredUnit") unitChanged = value;
        else if (field !== "theme") prefChanges.push(field); // flipping light/dark isn't worth logging
        user[field] = value;
      }
    }

    // email / in-app notification settings
    for (const field of ["notifyDailyDigest", "notifyRainAlerts"]) {
      if (req.body[field] === undefined) continue;
      if (typeof req.body[field] !== "boolean") return res.status(400).json({ message: `Invalid ${field}` });
      if (req.body[field] !== user[field]) { user[field] = req.body[field]; prefChanges.push(field); }
    }
    if (req.body.notifyDigestHour !== undefined) {
      const hour = Number(req.body.notifyDigestHour);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) return res.status(400).json({ message: "Choose an hour from 0 to 23" });
      if (hour !== user.notifyDigestHour) { user.notifyDigestHour = hour; user.lastDigestOn = ""; prefChanges.push("notifyDigestHour"); }
    }

    await user.save();

    if (Object.keys(profileChanges).length) {
      await track(req, { action: "profile.updated", description: `Updated profile (${Object.keys(profileChanges).join(", ")})`, changes: profileChanges });
    }
    if (prefChanges.length) {
      await track(req, { action: "profile.preferences", description: `Changed preferences (${prefChanges.join(", ")})`, count: false });
    }
    if (unitChanged) {
      await track(req, { action: "ui.unit_changed", description: `Switched temperature unit to °${unitChanged}` });
    }

    res.json({ user: user.toPublic() });
  } catch (error) {
    console.error("PATCH /users/me ERROR:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.put("/me/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "Enter a new password" });
    if (String(newPassword).length < 8) return res.status(400).json({ message: "New password must be at least 8 characters" });

    const user = await User.findById(req.user._id); // includes the password hash
    // people who signed up with Google have no password yet, so there is nothing to confirm
    if (user.passwordSet && !(await argon2.verify(user.password, String(currentPassword || "")))) {
      await track(req, { action: "auth.password_change_failed", description: "Password change failed — wrong current password", outcome: "failure", count: false });
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await argon2.hash(String(newPassword));
    user.passwordSet = true;
    await user.save();
    await revokeSessions(req.sessionStore, user._id, req.sessionID); // other devices must sign in again
    await track(req, { action: "auth.password_changed", description: "Changed account password" });

    res.json({ message: "Password updated" });
  } catch (error) {
    console.error("PUT /users/me/password ERROR:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
});

// ---- Profile photo (stored in MongoDB) ------------------------------------
router.put("/me/avatar", requireAuth, async (req, res) => {
  try {
    const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ""));
    if (!match) return res.status(400).json({ message: "Please upload a PNG, JPG or WebP image" });

    const buffer = Buffer.from(match[1], "base64");
    if (buffer.length > MAX_AVATAR_BYTES) return res.status(413).json({ message: "Image is too large" });

    const contentType = detectImageType(buffer);
    if (!contentType) return res.status(400).json({ message: "That file is not a valid image" });

    const user = await User.findById(req.user._id);
    user.avatar = { data: buffer, contentType };
    user.avatarVersion = Date.now();
    await user.save();

    await track(req, { action: "profile.avatar_changed", description: "Updated profile photo" });
    res.json({ user: user.toPublic() });
  } catch (error) {
    console.error("PUT /users/me/avatar ERROR:", error);
    res.status(500).json({ message: "Failed to save photo" });
  }
});

router.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { avatarVersion: 0 }, $unset: { avatar: 1 } });
    const user = await User.findById(req.user._id);
    await track(req, { action: "profile.avatar_removed", description: "Removed profile photo" });
    res.json({ user: user.toPublic() });
  } catch (error) {
    console.error("DELETE /users/me/avatar ERROR:", error);
    res.status(500).json({ message: "Failed to remove photo" });
  }
});

// The logged-in user's own recent activity (shown on their profile page)
router.get("/me/activity", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const logs = await ActivityLog.find({ actorId: req.user._id }).sort({ occurredAt: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (error) {
    console.error("GET /users/me/activity ERROR:", error);
    res.status(500).json({ message: "Failed to load activity" });
  }
});

router.get("/me/sessions", requireAuth, async (req, res) => {
  try {
    const sessions = await UserSession.find({ userId: req.user._id }).sort({ startedAt: -1 }).limit(10).lean();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: "Failed to load sessions" });
  }
});

// ---- Serve any user's photo -----------------------------------------------
router.get("/:id/avatar", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();

    const user = await User.findById(req.params.id).select("+avatar.data +avatar.contentType");
    if (!user?.avatar?.data) return res.status(404).end();

    res.set({
      "Content-Type": user.avatar.contentType || "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable", // URL carries ?v=version
      "X-Content-Type-Options": "nosniff",
    });
    res.send(user.avatar.data);
  } catch (error) {
    res.status(500).end();
  }
});

module.exports = router;
