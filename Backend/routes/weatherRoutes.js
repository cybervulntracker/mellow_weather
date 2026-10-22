const express = require("express");
const mongoose = require("mongoose");
const SearchHistory = require("../models/SearchHistory");
const Favorite = require("../models/Favorite");
const AlertRule = require("../models/AlertRule");
const requireAuth = require("../middleware/requireAuth");
const track = require("../utils/track");
const { loadWeather, toCompact } = require("../services/weatherService");
const { resolveCity, reverseGeocode } = require("../utils/geo");
const { getForecast } = require("../providers");
const { getTrends, getDailyRange, getClimate } = require("../providers/openmeteo");
const { normalFor } = require("../utils/climate");
const { describeCode } = require("../utils/conditions");

const router = express.Router();
const MAX_FAVORITES = 24;
const VIEW_SOURCES = ["history", "favorite", "location", "recent"];

/* ---------------- helpers ---------------- */

const httpError = (status, message) => Object.assign(new Error(message), { status });
const text = (v, max = 100) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const validCoords = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
const labelOf = (p) => [p.name, p.admin1, p.country].filter(Boolean).join(", ");
const nearby = (p) => ({ latitude: { $gte: p.latitude - 0.02, $lte: p.latitude + 0.02 }, longitude: { $gte: p.longitude - 0.02, $lte: p.longitude + 0.02 } });

// The browser normally sends exact coordinates it got from the suggestion list.
// A bare city name (default city, old history rows) is resolved with the ranked search.
async function resolvePlace(body) {
  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  const hasCoords = body.latitude != null && body.longitude != null && validCoords(lat, lon);
  const name = text(body.name);

  if (hasCoords && name) {
    return { name, admin1: text(body.admin1), country: text(body.country), countryCode: text(body.countryCode, 2).toUpperCase(), latitude: lat, longitude: lon };
  }
  if (hasCoords) return reverseGeocode(lat, lon);

  const query = text(body.city);
  if (!query) throw httpError(400, "Please choose a place");
  const found = await resolveCity(query);
  if (!found) throw httpError(404, `We couldn't find "${query}". Check the spelling or pick a suggestion.`);
  return found;
}

function sendError(res, error, what = "The weather service is not responding. Please try again in a moment.") {
  if (error.status) return res.status(error.status).json({ message: error.message });
  console.error("WEATHER ERROR:", error.message);
  return res.status(502).json({ message: what });
}

async function recordPlace(userId, place, searched) {
  const update = {
    $set: { city: place.name, admin1: place.admin1 || "", country: place.country || "Unknown", latitude: place.latitude, longitude: place.longitude, lastSearchedAt: new Date() },
    $inc: searched ? { views: 1, count: 1 } : { views: 1 },
  };
  if (!searched) update.$setOnInsert = { count: 0 }; // opened, not typed: doesn't count as a search
  await SearchHistory.findOneAndUpdate({ userId, placeKey: `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}` }, update, { upsert: true, setDefaultsOnInsert: true });
}

/* ---------------- weather for one place ---------------- */

// body: { name, admin1, country, latitude, longitude } (or { city } / GPS only) + source:
//   "search"                                  typed + chosen in the box -> counted as a search
//   "history" | "favorite" | "location" | "recent"   -> counted as a view
//   anything else ("default")                 -> not tracked
router.post("/", requireAuth, async (req, res) => {
  const source = String(req.body.source || "default");
  try {
    const place = await resolvePlace(req.body);
    const payload = await loadWeather(place);

    const favorite = await Favorite.findOne({ userId: req.user._id, ...nearby(place) }).select("_id isHome").lean();
    payload.favoriteId = favorite ? favorite._id : null;
    payload.isHome = Boolean(favorite?.isHome);

    if (source === "search") {
      await recordPlace(req.user._id, place, true);
      await track(req, { action: "weather.search", description: `Searched weather for ${labelOf(place)}`, targetLabel: labelOf(place) });
    } else if (VIEW_SOURCES.includes(source)) {
      await recordPlace(req.user._id, place, false);
      const from = { history: "recent places", recent: "recent places", favorite: "favourites", location: "current location" }[source];
      await track(req, { action: "weather.view", description: `Viewed ${labelOf(place)} from ${from}`, targetLabel: labelOf(place) });
    }
    res.json(payload);
  } catch (error) {
    if (error.status === 404 && source === "search") {
      await track(req, { action: "weather.search_failed", description: `Searched for "${text(req.body.city)}" — no match found`, targetLabel: text(req.body.city), outcome: "failure" });
    }
    sendError(res, error);
  }
});

// last 30 days of highs, lows and rain
router.get("/trends", requireAuth, async (req, res) => {
  try {
    const lat = Number(req.query.latitude), lon = Number(req.query.longitude);
    if (!validCoords(lat, lon)) throw httpError(400, "Invalid location");
    res.json({ days: await getTrends(lat, lon) });
  } catch (error) {
    sendError(res, error, "Trend data is not available right now.");
  }
});

// 2-4 places side by side
router.post("/compare", requireAuth, async (req, res) => {
  try {
    const list = Array.isArray(req.body.places) ? req.body.places : [];
    if (list.length < 2 || list.length > 4) throw httpError(400, "Choose between 2 and 4 places to compare");
    const places = list.map((p) => ({ name: text(p.name), admin1: text(p.admin1), country: text(p.country), latitude: Number(p.latitude), longitude: Number(p.longitude) }));
    if (places.some((p) => !p.name || !validCoords(p.latitude, p.longitude))) throw httpError(400, "One of the places is invalid");

    const results = await Promise.allSettled(places.map((p) => loadWeather(p)));
    await track(req, { action: "weather.compare", description: `Compared ${places.map((p) => p.name).join(", ")}`, targetLabel: places.map((p) => p.name).join(" vs ") });
    res.json({ items: results.map((r, i) => ({ place: places[i], data: r.status === "fulfilled" ? toCompact(r.value) : null })) });
  } catch (error) {
    sendError(res, error);
  }
});

// weather for chosen dates: real forecast for the next 16 days, "typical" from 10 years of history after that
router.post("/trip", requireAuth, async (req, res) => {
  try {
    const place = { name: text(req.body.name), admin1: text(req.body.admin1), country: text(req.body.country), latitude: Number(req.body.latitude), longitude: Number(req.body.longitude) };
    if (!place.name || !validCoords(place.latitude, place.longitude)) throw httpError(400, "Choose a place");

    const dateOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
    const { start, end } = req.body;
    if (!dateOk(start) || !dateOk(end)) throw httpError(400, "Choose a start and end date");
    const dayMs = 86400000;
    const span = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs + 1;
    const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    if (span < 1) throw httpError(400, "The end date must be after the start date");
    if (span > 14) throw httpError(400, "Trips can be up to 14 days long");
    if (Date.parse(`${start}T00:00:00Z`) < today - dayMs || Date.parse(`${start}T00:00:00Z`) > today + 365 * dayMs) throw httpError(400, "Choose dates within the next year");

    const [range, climate] = await Promise.all([getDailyRange(place.latitude, place.longitude), getClimate(place.latitude, place.longitude).catch(() => null)]);
    const forecastByDate = new Map(range.map((d) => [d.date, d]));

    const days = Array.from({ length: span }, (_, i) => {
      const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * dayMs).toISOString().slice(0, 10);
      const f = forecastByDate.get(date);
      if (f) {
        const info = describeCode(f.code, true);
        return { date, kind: "forecast", high: Math.round(f.max), low: Math.round(f.min), rainChance: f.precipProb ?? 0, rainMm: Math.round(f.precipSum * 10) / 10, icon: info.icon, conditionKey: info.key };
      }
      const normal = climate && normalFor(climate, date);
      if (!normal) return { date, kind: "unknown" };
      const share = Math.round(normal.rainyShare * 100);
      return { date, kind: "typical", high: Math.round(normal.max), low: Math.round(normal.min), rainChance: share, rainMm: Math.round(normal.precipMm * 10) / 10, icon: share >= 40 ? "rain" : share >= 20 ? "partly" : "clear", conditionKey: null };
    });

    const known = days.filter((d) => d.kind !== "unknown");
    const tips = [];
    if (known.some((d) => d.rainChance >= 40)) tips.push("umbrella");
    if (known.length && Math.max(...known.map((d) => d.high)) >= 38) tips.push("hydrate");
    if (known.length && Math.max(...known.map((d) => d.high)) >= 30) tips.push("light");
    if (known.length && Math.min(...known.map((d) => d.low)) <= 10) tips.push("warm");

    await track(req, { action: "weather.trip", description: `Planned a trip to ${labelOf(place)} (${start} to ${end})`, targetLabel: labelOf(place) });
    res.json({ place, days, tips });
  } catch (error) {
    sendError(res, error, "Trip planning is not available right now.");
  }
});

/* ---------------- recent places ---------------- */

router.get("/history", requireAuth, async (req, res) => {
  try {
    res.json(await SearchHistory.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(30).lean());
  } catch (error) {
    console.error("HISTORY ERROR:", error);
    res.status(500).json({ message: "Failed to load history" });
  }
});

router.delete("/history", requireAuth, async (req, res) => {
  try {
    const result = await SearchHistory.deleteMany({ userId: req.user._id });
    await track(req, { action: "weather.history_cleared", description: `Cleared all recent places (${result.deletedCount})` });
    res.json({ message: "History cleared", deleted: result.deletedCount });
  } catch (error) {
    console.error("CLEAR HISTORY ERROR:", error);
    res.status(500).json({ message: "Failed to clear history" });
  }
});

router.delete("/history/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "History not found" });
    const deleted = await SearchHistory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deleted) return res.status(404).json({ message: "History not found" });
    await track(req, {
      action: "weather.history_deleted", description: `Removed ${deleted.city}, ${deleted.country} from recent places`,
      targetId: deleted._id, targetLabel: `${deleted.city}, ${deleted.country}`,
    });
    res.json({ message: "History deleted successfully" });
  } catch (error) {
    console.error("DELETE HISTORY ERROR:", error);
    res.status(500).json({ message: "Failed to delete history" });
  }
});

/* ---------------- favourites ---------------- */

router.get("/favorites", requireAuth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id }).sort({ position: 1, createdAt: 1 }).lean();
    const enriched = await Promise.all(favorites.map(async (fav) => {
      try {
        const f = await getForecast(fav.latitude, fav.longitude); // cached for 5 minutes
        const info = describeCode(f.current.code, f.current.isDay);
        return { ...fav, temp: Math.round(f.current.temp), icon: info.icon, isDay: f.current.isDay, conditionKey: info.key };
      } catch {
        return { ...fav, temp: null, icon: "cloud", isDay: true, conditionKey: null };
      }
    }));
    res.json(enriched);
  } catch (error) {
    console.error("FAVORITES ERROR:", error);
    res.status(500).json({ message: "Failed to load favourites" });
  }
});

router.post("/favorites", requireAuth, async (req, res) => {
  try {
    const city = text(req.body.name);
    const latitude = Number(req.body.latitude), longitude = Number(req.body.longitude);
    if (!city || !validCoords(latitude, longitude)) return res.status(400).json({ message: "Invalid location" });

    const existing = await Favorite.findOne({ userId: req.user._id, ...nearby({ latitude, longitude }) });
    if (existing) return res.json(existing);

    const count = await Favorite.countDocuments({ userId: req.user._id });
    if (count >= MAX_FAVORITES) return res.status(400).json({ message: `You can save up to ${MAX_FAVORITES} places` });

    const favorite = await Favorite.create({
      userId: req.user._id, city, admin1: text(req.body.admin1), country: text(req.body.country), latitude, longitude,
      position: count, isHome: count === 0, // the first saved place becomes the home city
    });
    await track(req, { action: "favorite.added", description: `Added ${labelOf({ name: city, country: favorite.country })} to favourites`, targetId: favorite._id, targetLabel: `${city}, ${favorite.country}` });
    res.status(201).json(favorite);
  } catch (error) {
    console.error("ADD FAVORITE ERROR:", error);
    res.status(500).json({ message: "Failed to save favourite" });
  }
});

// drag-to-sort: body { ids: [favouriteId, ...] } in the new order
router.put("/favorites/order", requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    const mine = await Favorite.find({ userId: req.user._id }).select("_id").lean();
    const known = new Set(mine.map((f) => String(f._id)));
    const ordered = [...new Set(ids.filter((id) => known.has(id)))];
    const rest = mine.map((f) => String(f._id)).filter((id) => !ordered.includes(id));

    await Favorite.bulkWrite([...ordered, ...rest].map((id, position) => ({ updateOne: { filter: { _id: id, userId: req.user._id }, update: { $set: { position } } } })));
    await track(req, { action: "favorite.reordered", description: "Reordered favourites", count: false });
    res.json({ message: "Order saved" });
  } catch (error) {
    console.error("REORDER ERROR:", error);
    res.status(500).json({ message: "Failed to save the order" });
  }
});

router.patch("/favorites/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Favourite not found" });
    const fav = await Favorite.findOne({ _id: req.params.id, userId: req.user._id });
    if (!fav) return res.status(404).json({ message: "Favourite not found" });

    const changes = [];
    if (req.body.nickname !== undefined) {
      const nickname = text(req.body.nickname, 40);
      if (nickname !== fav.nickname) { fav.nickname = nickname; changes.push(nickname ? `renamed to "${nickname}"` : "name reset"); }
    }
    if (typeof req.body.isHome === "boolean" && req.body.isHome !== fav.isHome) {
      if (req.body.isHome) await Favorite.updateMany({ userId: req.user._id, _id: { $ne: fav._id } }, { $set: { isHome: false } });
      fav.isHome = req.body.isHome;
      changes.push(fav.isHome ? "set as home city" : "removed as home city");
    }
    if (changes.length) {
      await fav.save();
      await track(req, { action: "favorite.updated", description: `${fav.city}: ${changes.join(", ")}`, targetId: fav._id, targetLabel: `${fav.city}, ${fav.country}`, count: false });
    }
    res.json(fav);
  } catch (error) {
    console.error("UPDATE FAVORITE ERROR:", error);
    res.status(500).json({ message: "Failed to update favourite" });
  }
});

router.delete("/favorites/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Favourite not found" });
    const removed = await Favorite.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!removed) return res.status(404).json({ message: "Favourite not found" });

    await AlertRule.deleteMany({ userId: req.user._id, placeId: removed._id });
    if (removed.isHome) { // keep a home city while any place is saved
      const next = await Favorite.findOne({ userId: req.user._id }).sort({ position: 1, createdAt: 1 });
      if (next) await Favorite.updateOne({ _id: next._id }, { $set: { isHome: true } });
    }
    await track(req, {
      action: "favorite.removed", description: `Removed ${removed.city}, ${removed.country} from favourites`,
      targetId: removed._id, targetLabel: `${removed.city}, ${removed.country}`,
    });
    res.json({ message: "Removed from favourites" });
  } catch (error) {
    console.error("REMOVE FAVORITE ERROR:", error);
    res.status(500).json({ message: "Failed to remove favourite" });
  }
});

module.exports = router;
