const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const AlertRule = require("../models/AlertRule");
const Favorite = require("../models/Favorite");
const requireAuth = require("../middleware/requireAuth");
const track = require("../utils/track");

const { METRICS } = AlertRule;
const MAX_RULES = 10;
// sensible limits for each metric (°C, %, km/h, UV index, US AQI)
const LIMITS = { tempMax: [-50, 60], tempMin: [-80, 50], rainProb: [1, 100], windMax: [1, 300], uvMax: [1, 15], aqi: [1, 500] };

const router = express.Router();
router.use(requireAuth);

/* ---------------- inbox ---------------- */

router.get("/", async (req, res) => {
  try {
    const [items, unread] = await Promise.all([
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ userId: req.user._id, readAt: null }),
    ]);
    res.json({ items, unread });
  } catch (error) {
    console.error("NOTIFICATIONS ERROR:", error);
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

// one notification if `id` is given, otherwise all of them
router.post("/read", async (req, res) => {
  try {
    const filter = { userId: req.user._id, readAt: null };
    if (req.body.id) {
      if (!mongoose.isValidObjectId(req.body.id)) return res.status(404).json({ message: "Not found" });
      filter._id = req.body.id;
    }
    await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update notifications" });
  }
});

/* ---------------- alert rules ---------------- */

router.get("/rules", async (req, res) => {
  try {
    const [rules, favorites] = await Promise.all([
      AlertRule.find({ userId: req.user._id }).sort({ createdAt: 1 }).lean(),
      Favorite.find({ userId: req.user._id }).select("city nickname isHome").lean(),
    ]);
    const home = favorites.find((f) => f.isHome);
    const nameOf = (f) => f && (f.nickname || f.city);
    res.json({
      hasHome: Boolean(home),
      rules: rules.map((r) => ({ ...r, placeName: r.placeId ? nameOf(favorites.find((f) => String(f._id) === String(r.placeId))) || "" : nameOf(home) || "" })),
    });
  } catch (error) {
    console.error("RULES ERROR:", error);
    res.status(500).json({ message: "Failed to load alert rules" });
  }
});

router.post("/rules", async (req, res) => {
  try {
    const { metric } = req.body;
    const threshold = Number(req.body.threshold);
    if (!METRICS.includes(metric)) return res.status(400).json({ message: "Choose what to watch" });
    const [low, high] = LIMITS[metric];
    if (!Number.isFinite(threshold) || threshold < low || threshold > high) {
      return res.status(400).json({ message: `Enter a value between ${low} and ${high}` });
    }
    if ((await AlertRule.countDocuments({ userId: req.user._id })) >= MAX_RULES) {
      return res.status(400).json({ message: `You can have up to ${MAX_RULES} alert rules` });
    }

    let placeId = null;
    if (req.body.placeId) {
      if (!mongoose.isValidObjectId(req.body.placeId) || !(await Favorite.exists({ _id: req.body.placeId, userId: req.user._id }))) {
        return res.status(400).json({ message: "Choose one of your saved places" });
      }
      placeId = req.body.placeId;
    }

    const rule = await AlertRule.create({ userId: req.user._id, metric, threshold, placeId });
    await track(req, { action: "alert.rule_created", description: `Created an alert rule (${metric} ${metric === "tempMin" ? "≤" : "≥"} ${threshold})`, targetId: rule._id, count: false });
    res.status(201).json(rule);
  } catch (error) {
    console.error("CREATE RULE ERROR:", error);
    res.status(500).json({ message: "Failed to create the rule" });
  }
});

router.patch("/rules/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Rule not found" });
    if (typeof req.body.enabled !== "boolean") return res.status(400).json({ message: "Nothing to change" });
    const rule = await AlertRule.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { $set: { enabled: req.body.enabled } }, { returnDocument: "after" });
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: "Failed to update the rule" });
  }
});

router.delete("/rules/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Rule not found" });
    const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    await track(req, { action: "alert.rule_deleted", description: `Deleted an alert rule (${rule.metric})`, targetId: rule._id, count: false });
    res.json({ message: "Rule deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete the rule" });
  }
});

module.exports = router;
