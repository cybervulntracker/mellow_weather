const express = require("express");
const mongoose = require("mongoose");
const requireAdmin = require("../middleware/requireAdmin");
const User = require("../models/Users");
const ActivityLog = require("../models/ActivityLog");
const UserActivity = require("../models/UserActivity");
const DailyUsage = require("../models/DailyUsage");
const UserSession = require("../models/UserSession");
const SearchHistory = require("../models/SearchHistory");
const Favorite = require("../models/Favorite");
const SiteSettings = require("../models/SiteSettings");
const track = require("../utils/track");
const { resetMaintenanceCache } = require("../middleware/maintenance");
const { revokeSessions } = require("../utils/sessions");
const { deleteUserData } = require("../utils/accountCleanup");
const { LIVE_WINDOW_MS } = require("../utils/sessionTracker");
const { dayKey } = require("../utils/recordActivity");

const router = express.Router();
router.use(requireAdmin);

/* ---------------- helpers ---------------- */

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageParams = (req, defLimit = 20) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || defLimit, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
};
const liveCutoff = () => new Date(Date.now() - LIVE_WINDOW_MS);
const lastNDays = (n) => {
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86400000)));
  return days;
};
const withActor = { path: "actorId", select: "username email role avatarVersion" };
const withUser = { path: "userId", select: "username email role avatarVersion" };

const safeUser = (u) => (u && u.toPublic ? u.toPublic() : u);

// Most-searched cities: first collapse to one row per user+city, then count users per city
const topCitiesPipeline = (limit) => [
  { $match: { count: { $gt: 0 } } }, // places only opened (not searched) don't count
  { $group: { _id: { city: "$city", country: "$country", userId: "$userId" }, count: { $sum: "$count" } } },
  { $group: { _id: { city: "$_id.city", country: "$_id.country" }, count: { $sum: "$count" }, users: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: limit },
];
const flattenTop = (rows) => rows.map((r) => ({ city: r._id.city, country: r._id.country, count: r.count, users: r.users }));

/* ---------------- dashboard ---------------- */

router.get("/stats", async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 60);
    const dayList = lastNDays(days);
    const since = new Date(Date.now() - days * 86400000);
    const startOfToday = new Date(); startOfToday.setUTCHours(0, 0, 0, 0);

    const [
      users, admins, suspended, newUsers, activeNowIds, searchTotals, favoritesTotal,
      actionsToday, activityTotals, signups, dailyUsage, topCities, topFavorites, actionBreakdown, recent,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ status: "suspended" }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
      UserSession.distinct("userId", { endedAt: null, lastSeenAt: { $gte: liveCutoff() } }),
      UserActivity.aggregate([{ $group: { _id: null, total: { $sum: "$actionCounts.searches" } } }]), // lifetime searches, unaffected by deleted history
      Favorite.countDocuments(),
      ActivityLog.countDocuments({ occurredAt: { $gte: startOfToday } }),
      UserActivity.aggregate([{ $group: { _id: null, seconds: { $sum: "$totalActiveSeconds" }, actions: { $sum: "$totalActions" } } }]),
      User.find({ createdAt: { $gte: since } }).select("createdAt").lean(),
      DailyUsage.aggregate([
        { $match: { date: { $in: dayList } } },
        { $group: { _id: "$date", activeSeconds: { $sum: "$activeSeconds" }, actions: { $sum: "$actions" } } },
      ]),
      SearchHistory.aggregate(topCitiesPipeline(6)).then(flattenTop),
      Favorite.aggregate([
        { $group: { _id: { city: "$city", country: "$country" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]).then(flattenTop),
      ActivityLog.aggregate([
        { $match: { occurredAt: { $gte: since } } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      ActivityLog.find().populate(withActor).sort({ occurredAt: -1 }).limit(8).lean(),
    ]);

    const signupMap = {};
    for (const u of signups) { const k = dayKey(u.createdAt); signupMap[k] = (signupMap[k] || 0) + 1; }
    const usageMap = Object.fromEntries(dailyUsage.map((d) => [d._id, d]));

    res.json({
      totals: {
        users, admins, regularUsers: users - admins, suspended, newUsers,
        activeNow: activeNowIds.length,
        searches: searchTotals[0]?.total || 0,
        favorites: favoritesTotal,
        actionsToday,
        totalActiveSeconds: activityTotals[0]?.seconds || 0,
        totalActions: activityTotals[0]?.actions || 0,
      },
      signupsByDay: dayList.map((date) => ({ date, count: signupMap[date] || 0 })),
      usageByDay: dayList.map((date) => ({
        date,
        activeSeconds: usageMap[date]?.activeSeconds || 0,
        actions: usageMap[date]?.actions || 0,
      })),
      topCities,
      topFavorites,
      actionBreakdown: actionBreakdown.map((a) => ({ action: a._id, count: a.count })),
      recentActivity: recent,
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

/* ---------------- users ---------------- */

router.get("/users", async (req, res) => {
  try {
    const { limit, page, skip } = pageParams(req, 15);
    const filter = {};
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
      filter.$or = [{ email: rx }, { username: rx }];
    }
    if (["admin", "user"].includes(req.query.role)) filter.role = req.query.role;
    if (["active", "suspended"].includes(req.query.status)) filter.status = req.query.status;

    const sortKey = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, name: { username: 1 }, login: { lastLoginAt: -1 } }[req.query.sort] || { createdAt: -1 };

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select("-password").sort(sortKey).skip(skip).limit(limit),
    ]);

    const ids = users.map((u) => u._id);
    const [activities, onlineIds] = await Promise.all([
      UserActivity.find({ userId: { $in: ids } }).select("userId totalActiveSeconds totalActions totalSessions lastActivityAt").lean(),
      UserSession.distinct("userId", { userId: { $in: ids }, endedAt: null, lastSeenAt: { $gte: liveCutoff() } }),
    ]);
    const actMap = Object.fromEntries(activities.map((a) => [String(a.userId), a]));
    const online = new Set(onlineIds.map(String));

    res.json({
      total, page, pages: Math.max(Math.ceil(total / limit), 1),
      users: users.map((u) => {
        const a = actMap[String(u._id)];
        return {
          ...u.toPublic(),
          online: online.has(String(u._id)),
          totalActiveSeconds: a?.totalActiveSeconds || 0,
          totalActions: a?.totalActions || 0,
          totalSessions: a?.totalSessions || 0,
          lastActivityAt: a?.lastActivityAt || null,
        };
      }),
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "User not found" });
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const [summary, sessions, activity, favorites, searches, live, daily] = await Promise.all([
      UserActivity.findOne({ userId: user._id }).lean(),
      UserSession.find({ userId: user._id }).sort({ startedAt: -1 }).limit(10).lean(),
      ActivityLog.find({ actorId: user._id }).sort({ occurredAt: -1 }).limit(40).lean(),
      Favorite.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      SearchHistory.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(10).lean(),
      UserSession.exists({ userId: user._id, endedAt: null, lastSeenAt: { $gte: liveCutoff() } }),
      DailyUsage.find({ userId: user._id }).sort({ date: -1 }).limit(30).select("date activeSeconds actions -_id").lean(),
    ]);

    res.json({
      user: { ...user.toPublic(), online: Boolean(live) },
      summary: { totalActiveSeconds: 0, totalActions: 0, totalSessions: 0, averageSessionSeconds: 0, longestSessionSeconds: 0, actionCounts: {}, ...(summary || {}), dailyUsage: daily.reverse() },
      sessions, activity, favorites, searches,
    });
  } catch (error) {
    console.error("ADMIN USER DETAIL ERROR:", error);
    res.status(500).json({ message: "Failed to load user" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "User not found" });
    const target = await User.findById(req.params.id).select("-password");
    if (!target) return res.status(404).json({ message: "User not found" });

    const isSelf = String(target._id) === String(req.user._id);
    const { role, status } = req.body;

    if (role !== undefined && role !== target.role) {
      if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
      if (isSelf) return res.status(400).json({ message: "You can't change your own role" });
      const before = target.role;
      target.role = role;
      await target.save();
      await track(req, {
        action: "admin.user_role_changed",
        description: `Changed ${target.email} from ${before} to ${role}`,
        targetId: target._id, targetLabel: target.email, changes: { role: [before, role] },
      });
    }

    if (status !== undefined && status !== target.status) {
      if (!["active", "suspended"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      if (isSelf) return res.status(400).json({ message: "You can't suspend your own account" });
      target.status = status;
      await target.save();
      if (status === "suspended") {
        await UserSession.updateMany({ userId: target._id, endedAt: null }, { $set: { endedAt: new Date(), endReason: "expired" } });
      }
      await track(req, {
        action: status === "suspended" ? "admin.user_suspended" : "admin.user_reactivated",
        description: `${status === "suspended" ? "Suspended" : "Reactivated"} ${target.email}`,
        targetId: target._id, targetLabel: target.email,
      });
    }

    res.json({ user: safeUser(target) });
  } catch (error) {
    console.error("ADMIN UPDATE USER ERROR:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "User not found" });
    if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: "You can't delete your own account" });

    const target = await User.findById(req.params.id).select("-password");
    if (!target) return res.status(404).json({ message: "User not found" });

    await revokeSessions(req.sessionStore, target._id);
    await deleteUserData(target._id);
    // ActivityLog entries are kept on purpose — they are the audit trail.

    await track(req, {
      action: "admin.user_deleted",
      description: `Deleted account ${target.email}`,
      targetId: target._id, targetLabel: target.email,
    });
    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("ADMIN DELETE USER ERROR:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

/* ---------------- activity log ---------------- */

function buildActivityFilter(query) {
  const filter = {};
  if (mongoose.isValidObjectId(query.userId)) filter.actorId = query.userId;
  if (["admin", "user"].includes(query.role)) filter.actorRole = query.role;
  if (["success", "failure"].includes(query.outcome)) filter.outcome = query.outcome;
  if (query.action) filter.action = new RegExp(`^${escapeRegex(query.action)}`);
  if (query.q) filter.description = new RegExp(escapeRegex(String(query.q).trim()), "i");
  if (query.from || query.to) {
    filter.occurredAt = {};
    if (query.from && !Number.isNaN(Date.parse(query.from))) filter.occurredAt.$gte = new Date(query.from);
    if (query.to && !Number.isNaN(Date.parse(query.to))) { const t = new Date(query.to); t.setHours(23, 59, 59, 999); filter.occurredAt.$lte = t; }
  }
  return filter;
}

router.get("/activity", async (req, res) => {
  try {
    const { limit, page, skip } = pageParams(req, 25);
    const filter = buildActivityFilter(req.query);
    const [total, logs] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter).populate(withActor).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json({ total, page, pages: Math.max(Math.ceil(total / limit), 1), logs });
  } catch (error) {
    console.error("ACTIVITY FETCH ERROR:", error);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});

router.get("/activity/export", async (req, res) => {
  try {
    const logs = await ActivityLog.find(buildActivityFilter(req.query)).populate(withActor).sort({ occurredAt: -1 }).limit(5000).lean();
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Time", "User", "Email", "Role", "Action", "Description", "Target", "Outcome"].join(",")];
    for (const l of logs) {
      rows.push([
        new Date(l.occurredAt || l.createdAt).toISOString(), l.actorId?.username || "Deleted user", l.actorId?.email || "", l.actorRole,
        l.action, l.description, l.targetLabel || "", l.outcome,
      ].map(cell).join(","));
    }
    res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="activity-log.csv"' });
    res.send(rows.join("\n"));
  } catch (error) {
    console.error("ACTIVITY EXPORT ERROR:", error);
    res.status(500).json({ message: "Failed to export activity" });
  }
});

/* ---------------- sessions ---------------- */

router.get("/sessions", async (req, res) => {
  try {
    const { limit, page, skip } = pageParams(req, 20);
    const filter = {};
    if (req.query.status === "live") { filter.endedAt = null; filter.lastSeenAt = { $gte: liveCutoff() }; }
    if (mongoose.isValidObjectId(req.query.userId)) filter.userId = req.query.userId;

    const [total, sessions, liveCount] = await Promise.all([
      UserSession.countDocuments(filter),
      UserSession.find(filter).populate(withUser).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
      UserSession.countDocuments({ endedAt: null, lastSeenAt: { $gte: liveCutoff() } }),
    ]);

    const cutoff = liveCutoff();
    res.json({
      total, page, pages: Math.max(Math.ceil(total / limit), 1), liveCount,
      sessions: sessions.map((s) => ({
        ...s,
        status: s.endedAt ? "ended" : s.lastSeenAt >= cutoff ? "live" : "expired",
      })),
    });
  } catch (error) {
    console.error("ADMIN SESSIONS ERROR:", error);
    res.status(500).json({ message: "Failed to load sessions" });
  }
});

/* ---------------- weather data: searches & favourites ---------------- */

router.get("/searches", async (req, res) => {
  try {
    const { limit, page, skip } = pageParams(req, 20);
    const filter = { count: { $gt: 0 } };
    if (req.query.q) filter.city = new RegExp(escapeRegex(String(req.query.q).trim()), "i");

    const [total, items, top] = await Promise.all([
      SearchHistory.countDocuments(filter),
      SearchHistory.find(filter).populate(withUser).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      SearchHistory.aggregate(topCitiesPipeline(10)).then(flattenTop),
    ]);
    res.json({ total, page, pages: Math.max(Math.ceil(total / limit), 1), items, top });
  } catch (error) {
    console.error("ADMIN SEARCHES ERROR:", error);
    res.status(500).json({ message: "Failed to load searches" });
  }
});

router.delete("/searches/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const removed = await SearchHistory.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: "Not found" });
    await track(req, {
      action: "admin.search_deleted",
      description: `Deleted a search entry for ${removed.city}, ${removed.country}`,
      targetId: removed._id, targetLabel: `${removed.city}, ${removed.country}`,
    });
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete search" });
  }
});

router.get("/favorites", async (req, res) => {
  try {
    const { limit, page, skip } = pageParams(req, 20);
    const filter = {};
    if (req.query.q) filter.city = new RegExp(escapeRegex(String(req.query.q).trim()), "i");

    const [total, items, top] = await Promise.all([
      Favorite.countDocuments(filter),
      Favorite.find(filter).populate(withUser).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Favorite.aggregate([
        { $group: { _id: { city: "$city", country: "$country" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).then(flattenTop),
    ]);
    res.json({ total, page, pages: Math.max(Math.ceil(total / limit), 1), items, top });
  } catch (error) {
    console.error("ADMIN FAVORITES ERROR:", error);
    res.status(500).json({ message: "Failed to load favourites" });
  }
});

router.delete("/favorites/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const removed = await Favorite.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: "Not found" });
    await track(req, {
      action: "admin.favorite_deleted",
      description: `Deleted a favourite: ${removed.city}, ${removed.country}`,
      targetId: removed._id, targetLabel: `${removed.city}, ${removed.country}`,
    });
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete favourite" });
  }
});

/* ---------------- security ---------------- */

router.get("/security", async (req, res) => {
  try {
    const day = new Date(Date.now() - 86400000);
    const adminActions = /^admin\.user_/;
    const [failedLogins, adminChanges, passwordEvents, suspendedUsers, failed24h, blocked24h] = await Promise.all([
      ActivityLog.find({ action: { $in: ["auth.login_failed", "auth.login_blocked", "auth.password_change_failed"] } }).populate(withActor).sort({ occurredAt: -1 }).limit(40).lean(),
      ActivityLog.find({ action: adminActions }).populate(withActor).sort({ occurredAt: -1 }).limit(30).lean(),
      ActivityLog.find({ action: "auth.password_changed" }).populate(withActor).sort({ occurredAt: -1 }).limit(15).lean(),
      User.find({ status: "suspended" }).select("-password").sort({ updatedAt: -1 }),
      ActivityLog.countDocuments({ action: "auth.login_failed", occurredAt: { $gte: day } }),
      ActivityLog.countDocuments({ action: "auth.login_blocked", occurredAt: { $gte: day } }),
    ]);
    res.json({
      summary: { failed24h, blocked24h, suspended: suspendedUsers.length, adminChanges: adminChanges.length },
      failedLogins, adminChanges, passwordEvents,
      suspendedUsers: suspendedUsers.map(safeUser),
    });
  } catch (error) {
    console.error("ADMIN SECURITY ERROR:", error);
    res.status(500).json({ message: "Failed to load security events" });
  }
});

/* ---------------- settings ---------------- */

async function getSettings() {
  return SiteSettings.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
}

router.get("/settings", async (req, res) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    res.status(500).json({ message: "Failed to load settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const settings = await getSettings();
    const changed = [];
    const set = (key, valid) => {
      if (req.body[key] === undefined) return;
      const value = typeof settings[key] === "string" ? String(req.body[key]).trim() : req.body[key];
      if (!valid(value)) throw new Error(`Invalid value for ${key}`);
      if (value !== settings[key]) { settings[key] = value; changed.push(key); }
    };
    set("siteName", (v) => v.length > 0 && v.length <= 40);
    set("allowRegistrations", (v) => typeof v === "boolean");
    set("defaultUnit", (v) => ["C", "F"].includes(v));
    set("defaultCity", (v) => v.length > 0 && v.length <= 80);
    set("announcement", (v) => v.length <= 200);
    set("maintenanceMode", (v) => typeof v === "boolean");
    set("weeklyReport", (v) => typeof v === "boolean");
    set("maintenanceMessage", (v) => v.length <= 200);

    if (changed.length) {
      await settings.save();
      resetMaintenanceCache();
      await track(req, { action: "admin.settings_updated", description: `Updated site settings (${changed.join(", ")})`, changes: changed });
    }
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to save settings" });
  }
});

router.use(require("./adminInsightsRoutes"));

module.exports = router;
