// The weekly admin report: a short summary of the last 7 days, emailed to every admin.
const User = require("../models/Users");
const DailyUsage = require("../models/DailyUsage");
const ActivityLog = require("../models/ActivityLog");
const SearchHistory = require("../models/SearchHistory");
const SupportTicket = require("../models/SupportTicket");
const SiteSettings = require("../models/SiteSettings");
const { sendMail } = require("./mailer");
const { dayKey } = require("./recordActivity");

const DAY = 86400000;

async function buildWeeklyReport(now = Date.now()) {
  const since = new Date(now - 7 * DAY);
  const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now - i * DAY)));
  const [newUsers, usage, failures, topCities, openTickets, totalUsers] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: since } }),
    DailyUsage.aggregate([{ $match: { date: { $in: days } } }, { $group: { _id: null, actions: { $sum: "$actions" }, seconds: { $sum: "$activeSeconds" }, activeUsers: { $addToSet: "$userId" } } }]),
    ActivityLog.countDocuments({ occurredAt: { $gte: since }, outcome: "failure" }),
    SearchHistory.aggregate([{ $match: { count: { $gt: 0 }, updatedAt: { $gte: since } } }, { $group: { _id: "$city", count: { $sum: "$count" } } }, { $sort: { count: -1 } }, { $limit: 3 }]),
    SupportTicket.countDocuments({ status: "open" }),
    User.countDocuments(),
  ]);
  const u = usage[0] || {};
  return {
    from: dayKey(since), to: dayKey(new Date(now)),
    totalUsers, newUsers, activeUsers: (u.activeUsers || []).length, actions: u.actions || 0,
    activeHours: Math.round(((u.seconds || 0) / 3600) * 10) / 10, failures, openTickets,
    topCities: topCities.map((c) => c._id),
  };
}

const reportText = (r) =>
  [
    `MellowWeather weekly report (${r.from} to ${r.to})`, "",
    `Users: ${r.totalUsers} in total, ${r.newUsers} new this week`,
    `Active people: ${r.activeUsers} · Actions: ${r.actions} · Active time: ${r.activeHours} h`,
    `Failed actions: ${r.failures} · Open support messages: ${r.openTickets}`,
    r.topCities.length ? `Most searched: ${r.topCities.join(", ")}` : "No searches this week.",
  ].join("\n");

// Returns how many admins received it
async function sendWeeklyReport() {
  const report = await buildWeeklyReport();
  const admins = await User.find({ role: "admin", status: "active", emailVerified: true }).select("email").lean();
  for (const admin of admins) await sendMail({ to: admin.email, subject: `MellowWeather weekly report · ${report.to}`, text: reportText(report) });
  return admins.length;
}

// Called by the scheduler: sends once per ISO week on Monday morning (UTC), only when enabled in settings
async function maybeSendWeeklyReport(now = new Date()) {
  if (now.getUTCDay() !== 1 || now.getUTCHours() !== 4) return false;
  const settings = await SiteSettings.findOne({ key: "main" });
  if (!settings?.weeklyReport) return false;
  const stamp = dayKey(now);
  if (settings.lastReportOn === stamp) return false;
  settings.lastReportOn = stamp;
  await settings.save();
  await sendWeeklyReport();
  return true;
}

module.exports = { buildWeeklyReport, sendWeeklyReport, maybeSendWeeklyReport, reportText };
