const express = require("express");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/requireAuth");
const SupportTicket = require("../models/SupportTicket");
const track = require("../utils/track");

const router = express.Router();
router.use(requireAuth);

const MAX_OPEN = 5;

router.get("/", async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(30).lean();
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ message: "Failed to load your messages" });
  }
});

router.post("/", async (req, res) => {
  try {
    const subject = String(req.body.subject || "").trim();
    const text = String(req.body.text || "").trim();
    const category = ["bug", "idea", "account", "other"].includes(req.body.category) ? req.body.category : "other";
    if (subject.length < 3 || subject.length > 120) return res.status(400).json({ message: "Please write a short subject (3–120 characters)" });
    if (text.length < 5 || text.length > 2000) return res.status(400).json({ message: "Please describe it in 5–2000 characters" });

    const open = await SupportTicket.countDocuments({ userId: req.user._id, status: { $ne: "closed" } });
    if (open >= MAX_OPEN) return res.status(429).json({ message: "You already have several open messages. Please wait for a reply." });

    const ticket = await SupportTicket.create({ userId: req.user._id, subject, category, messages: [{ from: "user", authorId: req.user._id, text }] });
    await track(req, { action: "support.created", description: `Sent a support message: ${subject}`, targetId: String(ticket._id), targetLabel: subject });
    res.status(201).json({ ticket });
  } catch (error) {
    console.error("SUPPORT CREATE ERROR:", error);
    res.status(500).json({ message: "Failed to send your message" });
  }
});

router.post("/:id/reply", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const text = String(req.body.text || "").trim();
    if (text.length < 1 || text.length > 2000) return res.status(400).json({ message: "Please write a reply (up to 2000 characters)" });
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.user._id });
    if (!ticket) return res.status(404).json({ message: "Not found" });
    if (ticket.messages.length >= 60) return res.status(400).json({ message: "This conversation is full. Please start a new message." });
    ticket.messages.push({ from: "user", authorId: req.user._id, text });
    ticket.status = "open";
    await ticket.save();
    res.json({ ticket });
  } catch (error) {
    res.status(500).json({ message: "Failed to send your reply" });
  }
});

module.exports = router;
