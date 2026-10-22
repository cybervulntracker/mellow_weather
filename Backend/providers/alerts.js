// Official weather warnings from national weather services.
//   United States: api.weather.gov (National Weather Service) - free, no key.
// India (IMD) and Europe (MeteoAlarm) do not offer a stable public JSON API we could rely on, so places
// outside the US simply get no "official" section and keep our own forecast-based alerts.
const { getJson } = require("../utils/http");
const { memo } = require("../utils/cache");

// Rough boxes around the US states, Alaska, Hawaii and territories; keeps us from calling NWS for the rest of the world
const US_BOXES = [
  [24, 50, -125, -66], // contiguous
  [51, 72, -170, -129], // Alaska
  [18, 23, -161, -154], // Hawaii
  [17, 19, -68, -64], // Puerto Rico / USVI
];
const inUS = (lat, lon) => US_BOXES.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);

const SEVERITY = { Extreme: "extreme", Severe: "severe", Moderate: "moderate", Minor: "minor" };

// Pure and exported for tests: turns NWS GeoJSON into the small objects the website draws
function parseNws(data) {
  return (data?.features || [])
    .map((f) => f.properties || {})
    .filter((p) => p.event)
    .map((p) => ({
      source: "NWS",
      event: p.event,
      severity: SEVERITY[p.severity] || "minor",
      headline: String(p.headline || p.event).slice(0, 200),
      description: String(p.description || "").replace(/\s+/g, " ").trim().slice(0, 600),
      starts: p.onset || p.effective || null,
      ends: p.ends || p.expires || null,
      area: String(p.areaDesc || "").slice(0, 160),
    }))
    .slice(0, 5);
}

async function getOfficialAlerts(lat, lon) {
  if (!inUS(lat, lon)) return [];
  return memo("official-alerts", `${lat.toFixed(2)},${lon.toFixed(2)}`, 10 * 60000, async () => {
    const data = await getJson(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, 6000);
    return parseNws(data);
  });
}

module.exports = { getOfficialAlerts, parseNws, inUS };
