const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const PushSubscription = require("../models/PushSubscription");
const { sendPush, pushEnabled } = require("../utils/push");
const track = require("../utils/track");

const router = express.Router();
router.use(requireAuth);

const MAX_DEVICES = 8;

router.get("/status", async (req, res) => {
  const devices = await PushSubscription.countDocuments({ userId: req.user._id });
  res.json({ available: pushEnabled, devices });
});

router.post("/subscribe", async (req, res) => {
  try {
    if (!pushEnabled) return res.status(503).json({ message: "Push notifications are not set up on this server" });
    const { endpoint, keys } = req.body || {};
    if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid subscription" });
    }
    const count = await PushSubscription.countDocuments({ userId: req.user._id, endpoint: { $ne: endpoint } });
    if (count >= MAX_DEVICES) return res.status(400).json({ message: `You can enable push on up to ${MAX_DEVICES} devices` });

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user._id, endpoint, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) }, userAgent: String(req.get("user-agent") || "").slice(0, 200) },
      { upsert: true }
    );
    await track(req, { action: "push.enabled", description: "Turned on browser notifications on a device" });
    res.json({ message: "Browser notifications are on" });
  } catch (error) {
    console.error("PUSH SUBSCRIBE ERROR:", error);
    res.status(500).json({ message: "Could not save the subscription" });
  }
});

router.post("/unsubscribe", async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    const filter = { userId: req.user._id };
    if (typeof endpoint === "string") filter.endpoint = endpoint;
    await PushSubscription.deleteMany(filter);
    await track(req, { action: "push.disabled", description: "Turned off browser notifications" });
    res.json({ message: "Browser notifications are off" });
  } catch (error) {
    res.status(500).json({ message: "Could not remove the subscription" });
  }
});

router.post("/test", async (req, res) => {
  const sent = await sendPush(req.user._id, { title: "MellowWeather", body: "Browser notifications are working 🌤️" });
  res.json({ sent });
});

module.exports = router;
