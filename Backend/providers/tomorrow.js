// Optional upgrade: minute-by-minute rain and a pollen index from Tomorrow.io.
// Only used when TOMORROW_API_KEY is in .env (free tier available). Everything else works without it.
const { getJson } = require("../utils/http");
const { memo } = require("../utils/cache");
const { localParts } = require("../utils/time");

const enabled = Boolean(process.env.TOMORROW_API_KEY);

// Pure and exported for tests. `data` is the /v4/weather/forecast JSON for timesteps=1m and 1h.
function parseTomorrow(data, timezone, now = new Date()) {
  const minutes = data?.timelines?.minutely || [];
  const minutely = minutes
    .filter((m) => new Date(m.time) >= new Date(now.getTime() - 60000))
    .slice(0, 60)
    .map((m) => ({
      time: localParts(new Date(m.time), timezone).iso,
      // rain rate in mm/h, scaled to the same "per 15 minutes" unit the 15-minute data uses
      mm: Math.round(((m.values?.precipitationIntensity || 0) / 4) * 100) / 100,
    }));

  const hour = data?.timelines?.hourly?.[0]?.values || {};
  const pick = (key, value) => (typeof value === "number" ? { key, index: value } : null);
  const items = [pick("tree", hour.treeIndex), pick("grass", hour.grassIndex), pick("weed", hour.weedIndex)].filter(Boolean);
  return { minutely, pollenIndex: items.length ? { max: 5, items } : null };
}

async function getExtras(lat, lon, timezone = "UTC") {
  if (!enabled) return null;
  return memo("tomorrow", `${lat.toFixed(2)},${lon.toFixed(2)}`, 5 * 60000, async () => {
    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&timesteps=1m&timesteps=1h&apikey=${process.env.TOMORROW_API_KEY}`;
    return parseTomorrow(await getJson(url, 6000), timezone);
  });
}

module.exports = { enabled, getExtras, parseTomorrow };
