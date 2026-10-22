// Admin extras: analytics, system health, bulk user actions, audit trail, support inbox, reports.
// Mounted inside adminRoutes.js, so every route here already requires an admin.
const express = require("express");
const mongoose = require("mongoose");
const os = require("os");
const User = require("../models/Users");
const ActivityLog = require("../models/ActivityLog");
const DailyUsage = require("../models/DailyUsage");
const UserSession = require("../models/UserSession");
const SearchHistory = require("../models/SearchHistory");
const Favorite = require("../models/Favorite");
const Notification = require("../models/Notification");
const SupportTicket = require("../models/SupportTicket");
const PushSubscription = require("../models/PushSubscription");
const track = require("../utils/track");
const { revokeSessions } = require("../utils/sessions");
const { deleteUserData } = require("../utils/accountCleanup");
const { dayKey } = require("../utils/recordActivity");
const { buildWeeklyReport, sendWeeklyReport } = require("../utils/reports");
const { schedulerStatus } = require("../utils/scheduler");

const router = express.Router();
const DAY = 86400000;

const clampDays = (value, fallback = 30) => Math.min(Math.max(Number(value) || fallback, 7), 90);
const lastNDays = (n, end = Date.now()) => Array.from({ length: n }, (_, i) => dayKey(new Date(end - (n - 1 - i) * DAY)));
const pct = (now, before) => (before ? Math.round(((now - before) / before) * 1000) / 10 : now ? 100 : 0);
const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0);

/* ---------------- analytics ---------------- */

// Everything the Analytics page draws, for the last N days plus the N days before (for "vs previous period")
router.get("/analytics", async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const now = Date.now();
    const since = new Date(now - days * DAY);
    const prevSince = new Date(now - 2 * days * DAY);
    const dayList = lastNDays(days);
    const prevList = lastNDays(days, now - days * DAY);

    const [usageRows, prevUsageRows, signups, heat, actions, browsers, systems, devices, sessionLen, cities, statusSplit, roleSplit, failures] = await Promise.all([
      DailyUsage.aggregate([
        { $match: { date: { $in: dayList } } },
        { $group: { _id: "$date", activeSeconds: { $sum: "$activeSeconds" }, actions: { $sum: "$actions" }, users: { $sum: 1 } } },
      ]),
      DailyUsage.aggregate([
        { $match: { date: { $in: prevList } } },
        { $group: { _id: null, activeSeconds: { $sum: "$activeSeconds" }, actions: { $sum: "$actions" }, userDays: { $sum: 1 } } },
      ]),
      User.find({ createdAt: { $gte: prevSince } }).select("createdAt").lean(),
      ActivityLog.aggregate([
        { $match: { occurredAt: { $gte: since } } },
        { $group: { _id: { dow: { $dayOfWeek: "$occurredAt" }, hour: { $hour: "$occurredAt" } }, count: { $sum: 1 } } },
      ]),
      ActivityLog.aggregate([
        { $match: { occurredAt: { $gte: since } } },
        { $group: { _id: { $arrayElemAt: [{ $split: ["$action", "."] }, 0] }, count: { $sum: 1 }, failures: { $sum: { $cond: [{ $eq: ["$outcome", "failure"] }, 1, 0] } } } },
        { $sort: { count: -1 } },
      ]),
      UserSession.aggregate([{ $match: { startedAt: { $gte: since } } }, { $group: { _id: { $ifNull: ["$browser", "Unknown"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
      UserSession.aggregate([{ $match: { startedAt: { $gte: since } } }, { $group: { _id: { $ifNull: ["$os", "Unknown"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
      UserSession.aggregate([{ $match: { startedAt: { $gte: since } } }, { $group: { _id: { $ifNull: ["$device", "Unknown"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      UserSession.aggregate([
        { $match: { startedAt: { $gte: since } } },
        { $bucket: { groupBy: "$activeSeconds", boundaries: [0, 60, 300, 900, 1800, 3600, 1e9], default: "other", output: { count: { $sum: 1 } } } },
      ]),
      SearchHistory.aggregate([
        { $match: { count: { $gt: 0 }, updatedAt: { $gte: since } } },
        { $group: { _id: { city: "$city", country: "$country" }, count: { $sum: "$count" } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      User.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      ActivityLog.countDocuments({ occurredAt: { $gte: since }, outcome: "failure" }),
    ]);

    const usageMap = Object.fromEntries(usageRows.map((r) => [r._id, r]));
    const signupMap = {};
    let signupsNow = 0;
    let signupsBefore = 0;
    for (const u of signups) {
      if (u.createdAt >= since) { signupsNow += 1; const k = dayKey(u.createdAt); signupMap[k] = (signupMap[k] || 0) + 1; } else signupsBefore += 1;
    }

    const series = dayList.map((date) => ({
      date,
      activeUsers: usageMap[date]?.users || 0,
      actions: usageMap[date]?.actions || 0,
      activeMinutes: Math.round((usageMap[date]?.activeSeconds || 0) / 60),
      signups: signupMap[date] || 0,
    }));
    const prev = prevUsageRows[0] || {};
    const totals = {
      actions: sum(series, "actions"),
      activeMinutes: sum(series, "activeMinutes"),
      signups: signupsNow,
      activeUserDays: sum(series, "activeUsers"),
    };

    // 7 x 24 grid: rows Sunday..Saturday (Mongo's $dayOfWeek is 1 = Sunday), hours are UTC
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const h of heat) grid[h._id.dow - 1][h._id.hour] = h.count;

    const labelledBuckets = ["<1 min", "1–5 min", "5–15 min", "15–30 min", "30–60 min", "1 h+"];
    const bucketMap = Object.fromEntries(sessionLen.map((b) => [b._id, b.count]));
    const sessionLengths = [0, 60, 300, 900, 1800, 3600].map((b, i) => ({ label: labelledBuckets[i], count: bucketMap[b] || 0 }));

    res.json({
      days,
      series,
      totals,
      deltas: {
        actions: pct(totals.actions, prev.actions || 0),
        activeMinutes: pct(totals.activeMinutes, Math.round((prev.activeSeconds || 0) / 60)),
        signups: pct(signupsNow, signupsBefore),
        activeUserDays: pct(totals.activeUserDays, prev.userDays || 0),
      },
      heatmap: grid,
      actionGroups: actions.map((a) => ({ group: a._id, count: a.count, failures: a.failures })),
      browsers: browsers.map((b) => ({ label: b._id || "Unknown", count: b.count })),
      systems: systems.map((b) => ({ label: b._id || "Unknown", count: b.count })),
      devices: devices.map((b) => ({ label: b._id || "Unknown", count: b.count })),
      sessionLengths,
      topCities: cities.map((c) => ({ city: c._id.city, country: c._id.country, count: c.count })),
      userStatus: Object.fromEntries(statusSplit.map((s) => [s._id, s.count])),
      userRoles: Object.fromEntries(roleSplit.map((s) => [s._id, s.count])),
      failureRate: totals.actions ? Math.round((failures / Math.max(totals.actions, 1)) * 1000) / 10 : 0,
    });
  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});

// Weekly sign-up cohorts: of the people who joined in week W, how many came back in week W+k?
router.get("/retention", async (req, res) => {
  try {
    const weeks = 6;
    const now = Date.now();
    const weekStart = (i) => now - (i + 1) * 7 * DAY; // i = 0 is the most recent full 7 days
    const earliest = new Date(weekStart(weeks - 1));
    const users = await User.find({ createdAt: { $gte: earliest } }).select("createdAt").lean();
    const usage = await DailyUsage.find({ date: { $gte: dayKey(earliest) } }).select("userId date").lean();

    const activeByUser = new Map();
    for (const row of usage) {
      const set = activeByUser.get(String(row.userId)) || new Set();
      set.add(row.date);
      activeByUser.set(String(row.userId), set);
    }

    const cohorts = [];
    for (let c = weeks - 1; c >= 0; c--) {
      const start = weekStart(c);
      const members = users.filter((u) => u.createdAt.getTime() >= start && u.createdAt.getTime() < start + 7 * DAY);
      const row = { label: dayKey(new Date(start)), size: members.length, retention: [] };
      for (let k = 0; k <= c; k++) {
        const from = start + k * 7 * DAY;
        const dates = new Set(Array.from({ length: 7 }, (_, d) => dayKey(new Date(from + d * DAY))));
        const back = members.filter((u) => [...(activeByUser.get(String(u._id)) || [])].some((d) => dates.has(d))).length;
        row.retention.push(members.length ? Math.round((back / members.length) * 100) : null);
      }
      cohorts.push(row);
    }
    res.json({ weeks, cohorts });
  } catch (error) {
    console.error("ADMIN RETENTION ERROR:", error);
    res.status(500).json({ message: "Failed to load retention" });
  }
});

/* ---------------- system health ---------------- */

router.get("/system", async (req, res) => {
  try {
    const started = Date.now();
    const [users, sessions, logs, searches, favorites, notifications, tickets, devices] = await Promise.all([
      User.estimatedDocumentCount(), UserSession.estimatedDocumentCount(), ActivityLog.estimatedDocumentCount(),
      SearchHistory.estimatedDocumentCount(), Favorite.estimatedDocumentCount(), Notification.estimatedDocumentCount(),
      SupportTicket.countDocuments({ status: "open" }), PushSubscription.estimatedDocumentCount(),
    ]);
    const mem = process.memoryUsage();
    res.json({
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      database: { state: ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState], pingMs: Date.now() - started },
      memory: { rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576), heapTotalMb: Math.round(mem.heapTotal / 1048576) },
      cpu: { load1: Math.round(os.loadavg()[0] * 100) / 100, cores: os.cpus().length },
      collections: { users, sessions, activityLogs: logs, searches, favorites, notifications, pushDevices: devices },
      openTickets: tickets,
      scheduler: schedulerStatus(),
      features: {
        smtp: Boolean(process.env.SMTP_HOST), google: Boolean(process.env.GOOGLE_CLIENT_ID), push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        officialAlerts: true, tomorrowKey: Boolean(process.env.TOMORROW_API_KEY), geoapifyKey: Boolean(process.env.GEOAPIFY_KEY),
        httpsCookies: process.env.NODE_ENV === "production",
      },
    });
  } catch (error) {
    console.error("ADMIN SYSTEM ERROR:", error);
    res.status(500).json({ message: "Failed to load system health" });
  }
});

/* ---------------- bulk user actions ---------------- */

const BULK_ACTIONS = ["suspend", "activate", "delete", "verify"];
router.post("/users/bulk", async (req, res) => {
  try {
    const { action } = req.body;
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map(String))].filter((id) => mongoose.isValidObjectId(id)) : [];
    if (!BULK_ACTIONS.includes(action)) return res.status(400).json({ message: "Unknown action" });
    if (!ids.length) return res.status(400).json({ message: "Select at least one user" });
    if (ids.length > 100) return res.status(400).json({ message: "You can change up to 100 users at once" });

    const targets = await User.find({ _id: { $in: ids } }).select("-password");
    const skipped = [];
    let changed = 0;

    // Never let a bulk action lock out or delete the last admins
    const adminCount = await User.countDocuments({ role: "admin", status: "active" });
    let adminsLeft = adminCount;

    for (const user of targets) {
      if (String(user._id) === String(req.user._id)) { skipped.push({ email: user.email, reason: "that's you" }); continue; }
      const removesAdmin = user.role === "admin" && user.status === "active" && ["suspend", "delete"].includes(action);
      if (removesAdmin && adminsLeft <= 1) { skipped.push({ email: user.email, reason: "last active admin" }); continue; }
      if (removesAdmin) adminsLeft -= 1;

      if (action === "suspend") {
        if (user.status === "suspended") continue;
        user.status = "suspended"; await user.save(); await revokeSessions(req.sessionStore, user._id);
      } else if (action === "activate") {
        if (user.status === "active") continue;
        user.status = "active"; await user.save();
      } else if (action === "verify") {
        if (user.emailVerified) continue;
        user.emailVerified = true; await user.save();
      } else {
        await revokeSessions(req.sessionStore, user._id); await deleteUserData(user._id);
      }
      changed += 1;
      await track(req, { action: `admin.bulk_${action}`, description: `Bulk ${action}: ${user.email}`, targetId: user._id, targetLabel: user.email });
    }
    res.json({ changed, skipped, message: `${changed} user${changed === 1 ? "" : "s"} updated` });
  } catch (error) {
    console.error("ADMIN BULK ERROR:", error);
    res.status(500).json({ message: "Bulk action failed" });
  }
});

/* ---------------- audit trail (read-only on purpose) ---------------- */

router.get("/audit", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = { action: /^admin\./ };
    if (req.query.action) filter.action = new RegExp(`^admin\\.${String(req.query.action).replace(/[^a-z_]/gi, "")}`);
    const [total, logs, byAction] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter).populate({ path: "actorId", select: "username email avatarVersion role" }).sort({ occurredAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLog.aggregate([{ $match: { action: /^admin\./ } }, { $group: { _id: "$action", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);
    res.json({ total, page, pages: Math.max(Math.ceil(total / limit), 1), logs, actions: byAction.map((a) => ({ action: a._id, count: a.count })) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load the audit trail" });
  }
});

/* ---------------- support inbox ---------------- */

router.get("/support", async (req, res) => {
  try {
    const filter = ["open", "answered", "closed"].includes(req.query.status) ? { status: req.query.status } : {};
    const [tickets, counts] = await Promise.all([
      SupportTicket.find(filter).populate({ path: "userId", select: "username email avatarVersion" }).sort({ updatedAt: -1 }).limit(100).lean(),
      SupportTicket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    res.json({ tickets, counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load the inbox" });
  }
});

router.post("/support/:id/reply", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const text = String(req.body.text || "").trim();
    if (!text || text.length > 2000) return res.status(400).json({ message: "Please write a reply (up to 2000 characters)" });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Not found" });
    ticket.messages.push({ from: "admin", authorId: req.user._id, text });
    ticket.status = "answered";
    await ticket.save();
    await Notification.create({
      userId: ticket.userId, kind: "support", dedupeKey: `support:${ticket._id}:${ticket.messages.length}`, place: "",
      title: { key: "supportReplyTitle", params: {} }, lines: [{ key: "supportReplyLine", params: { subject: ticket.subject } }],
    });
    await track(req, { action: "admin.support_replied", description: `Replied to "${ticket.subject}"`, targetId: ticket._id, targetLabel: ticket.subject });
    res.json({ ticket });
  } catch (error) {
    console.error("ADMIN SUPPORT REPLY ERROR:", error);
    res.status(500).json({ message: "Failed to send the reply" });
  }
});

router.patch("/support/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !["open", "answered", "closed"].includes(req.body.status)) return res.status(400).json({ message: "Invalid request" });
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!ticket) return res.status(404).json({ message: "Not found" });
    await track(req, { action: "admin.support_status", description: `Marked "${ticket.subject}" as ${ticket.status}`, targetId: ticket._id, targetLabel: ticket.subject });
    res.json({ ticket });
  } catch (error) {
    res.status(500).json({ message: "Failed to update the message" });
  }
});

/* ---------------- reports ---------------- */

router.get("/reports/weekly", async (req, res) => {
  try {
    res.json(await buildWeeklyReport());
  } catch (error) {
    res.status(500).json({ message: "Failed to build the report" });
  }
});

router.post("/reports/send", async (req, res) => {
  try {
    const sent = await sendWeeklyReport();
    await track(req, { action: "admin.report_sent", description: `Sent the weekly report to ${sent} admin${sent === 1 ? "" : "s"}` });
    res.json({ sent, message: `Report sent to ${sent} admin${sent === 1 ? "" : "s"}` });
  } catch (error) {
    res.status(500).json({ message: "Failed to send the report" });
  }
});

module.exports = router;
