// Runs every 15 minutes: morning digests, "rain tomorrow" alerts and custom alert rules.
// Each notification goes to the in-app inbox, and by email when the address is verified.
const tzlookup = require("tz-lookup");
const User = require("../models/Users");
const Favorite = require("../models/Favorite");
const AlertRule = require("../models/AlertRule");
const Notification = require("../models/Notification");
const AuthToken = require("../models/AuthToken");
const { getForecast } = require("../providers");
const { getAirQuality } = require("../providers/openmeteo");
const { buildSummary } = require("./insights");
const { localParts } = require("./time");
const { sendMail } = require("./mailer");
const { renderLine, subjectFor, footerFor } = require("./messages");
const { sendPush } = require("./push");
const { maybeSendWeeklyReport } = require("./reports");

const RAIN_ALERT_HOUR = 18; // local evening: "rain tomorrow"
const MAX_ALERT_PLACES = 5;

const placeName = (fav) => fav.nickname || fav.city;
const localDateAt = (fav, now) => localParts(now, tzlookup(fav.latitude, fav.longitude));

// Creates the inbox item once (same key = already sent), pushes it to the person's devices,
// and emails it if the address is verified. Emails and pushes use the person's language.
async function notify(user, { kind, dedupeKey, place, title, lines }) {
  if (await Notification.exists({ userId: user._id, dedupeKey })) return false;
  await Notification.create({ userId: user._id, kind, dedupeKey, place, title, lines });

  const lang = user.language || "en";
  const rendered = lines.map((line) => renderLine(line, lang)).filter(Boolean);
  await sendPush(user._id, { title: `MellowWeather · ${place}`, body: rendered[0] || "" }).catch((e) => console.error("PUSH ERROR:", e.message));

  if (user.emailVerified) {
    await sendMail({ to: user.email, subject: `MellowWeather · ${place}: ${subjectFor(kind, lang)}`, text: `${rendered.join("\n")}\n\n${footerFor(lang)}` });
  }
  return true;
}

async function sendDigest(user, home, local) {
  const [forecast, air] = await Promise.all([getForecast(home.latitude, home.longitude), getAirQuality(home.latitude, home.longitude)]);
  const { sentences, tips } = buildSummary(forecast, air);
  await notify(user, {
    kind: "digest", dedupeKey: `digest:${local.date}`, place: placeName(home),
    title: { key: "digestTitle", params: { city: placeName(home) } },
    lines: [...sentences, ...(tips.length ? [{ key: "tips", params: { list: tips } }] : [])],
  });
  user.lastDigestOn = local.date;
  await user.save();
}

async function rainAlert(user, places) {
  for (const place of places.slice(0, MAX_ALERT_PLACES)) {
    const tomorrow = (await getForecast(place.latitude, place.longitude)).daily[1];
    if (!tomorrow || !((tomorrow.precipProb ?? 0) >= 60 || tomorrow.precipSum >= 5)) continue;
    await notify(user, {
      kind: "rain", dedupeKey: `rain:${place._id}:${tomorrow.date}`, place: placeName(place),
      title: { key: "rainTomorrowTitle", params: { city: placeName(place) } },
      lines: [{ key: "rainTomorrowLine", params: { prob: tomorrow.precipProb ?? 0, mm: Math.round(tomorrow.precipSum * 10) / 10 } }],
    });
  }
}

// What each rule measures over today + tomorrow, and whether it is "above" or "at or below"
function ruleValue(metric, forecast, air) {
  const days = forecast.daily.slice(0, 2);
  const values = (key) => days.map((d) => d[key]).filter((v) => v != null);
  switch (metric) {
    case "tempMax": return Math.max(...values("max"));
    case "tempMin": return Math.min(...values("min"));
    case "rainProb": return Math.max(...values("precipProb"));
    case "windMax": return Math.max(...days.map((d) => d.gustMax ?? d.windMax ?? 0));
    case "uvMax": return Math.max(...values("uvMax"));
    default: return air ? air.aqi : null;
  }
}
const breached = (rule, value) => Number.isFinite(value) && (rule.metric === "tempMin" ? value <= rule.threshold : value >= rule.threshold);

async function checkRules(now) {
  const rules = await AlertRule.find({ enabled: true }).lean();
  const byUser = new Map();
  for (const rule of rules) byUser.set(String(rule.userId), [...(byUser.get(String(rule.userId)) || []), rule]);

  for (const [userId, userRules] of byUser) {
    const [user, favorites] = await Promise.all([User.findById(userId), Favorite.find({ userId }).lean()]);
    if (!user || user.status !== "active") continue;
    const home = favorites.find((f) => f.isHome);

    for (const rule of userRules) {
      const place = rule.placeId ? favorites.find((f) => String(f._id) === String(rule.placeId)) : home;
      if (!place) continue;
      const today = localDateAt(place, now).date;
      if (rule.lastTriggeredOn === today) continue;

      const [forecast, air] = await Promise.all([getForecast(place.latitude, place.longitude), getAirQuality(place.latitude, place.longitude)]);
      const value = ruleValue(rule.metric, forecast, air);
      if (!breached(rule, value)) continue;

      await notify(user, {
        kind: "rule", dedupeKey: `rule:${rule._id}:${today}`, place: placeName(place),
        title: { key: "ruleTitle", params: { city: placeName(place) } },
        lines: [{ key: `rule_${rule.metric}`, params: { value: Math.round(value), threshold: rule.threshold } }],
      });
      await AlertRule.updateOne({ _id: rule._id }, { $set: { lastTriggeredOn: today } });
    }
  }
}

// One pass. Safe to call any time: every notification is sent at most once per day.
async function runNotificationTick(now = new Date()) {
  await AuthToken.deleteMany({ expiresAt: { $lt: now } });

  const users = await User.find({ status: "active", $or: [{ notifyDailyDigest: true }, { notifyRainAlerts: true }] });
  for (const user of users) {
    try {
      const favorites = await Favorite.find({ userId: user._id }).sort({ position: 1 }).lean();
      const home = favorites.find((f) => f.isHome);
      if (!home) continue;
      const local = localDateAt(home, now);

      if (user.notifyDailyDigest && local.hour === user.notifyDigestHour && user.lastDigestOn !== local.date) await sendDigest(user, home, local);
      if (user.notifyRainAlerts && local.hour === RAIN_ALERT_HOUR) {
        await rainAlert(user, [home, ...favorites.filter((f) => !f.isHome)]);
      }
    } catch (error) {
      console.error(`NOTIFICATION ERROR for ${user.email}:`, error.message);
    }
  }
  try {
    await checkRules(now);
  } catch (error) {
    console.error("ALERT RULE ERROR:", error.message);
  }
  try {
    await maybeSendWeeklyReport(now);
  } catch (error) {
    console.error("WEEKLY REPORT ERROR:", error.message);
  }
  status.lastTickAt = new Date();
}

const status = { running: false, lastTickAt: null, mode: "off" };
const schedulerStatus = () => ({ ...status, inApp: process.env.RUN_SCHEDULER_IN_APP !== "0" });

// `unref` lets a normal process exit; the worker passes keepAlive so it stays running on its own.
function startScheduler({ keepAlive = false } = {}) {
  if (process.env.DISABLE_SCHEDULER === "1") return;
  const timer = setInterval(() => runNotificationTick().catch((e) => console.error("SCHEDULER ERROR:", e.message)), 15 * 60 * 1000);
  if (!keepAlive) timer.unref();
  status.running = true;
  status.mode = keepAlive ? "worker" : "in-app";
  console.log("Notification scheduler started (every 15 minutes)");
}

module.exports = { startScheduler, runNotificationTick, schedulerStatus };
