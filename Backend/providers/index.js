// Picks a weather source and refuses to show impossible numbers.
const openMeteo = require("./openmeteo");
const metno = require("./metno");
const { memo } = require("../utils/cache");

// Returns a list of problems; empty means the data looks believable.
function checkSanity(f) {
  const problems = [];
  const c = f?.current;
  if (!c) return ["no current conditions"];
  const inRange = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  if (!inRange(c.temp, -90, 60)) problems.push(`temperature ${c.temp}`);
  if (!inRange(c.feels, -120, 80)) problems.push(`feels-like ${c.feels}`);
  if (!inRange(c.humidity, 0, 100)) problems.push(`humidity ${c.humidity}`);
  if (!inRange(c.windKmh, 0, 400)) problems.push(`wind ${c.windKmh}`);
  if (!inRange(c.pressure, 850, 1100)) problems.push(`pressure ${c.pressure}`);
  if (!Array.isArray(f.hourly) || f.hourly.length < 24) problems.push("fewer than 24 hourly values");
  if (!Array.isArray(f.daily) || f.daily.length < 3) problems.push("fewer than 3 daily values");
  else if (f.daily.some((d) => !(d.max >= d.min))) problems.push("daily high below daily low");
  return problems;
}

async function loadForecast(lat, lon, sources = { primary: openMeteo, backup: metno }) {
  const attempt = async (source, name) => {
    const forecast = await source.fetchForecast(lat, lon);
    const problems = checkSanity(forecast);
    if (problems.length) throw new Error(`${name} data failed sanity check: ${problems.join(", ")}`);
    return forecast;
  };

  try {
    return { ...(await attempt(sources.primary, "Open-Meteo")), provider: "open-meteo", degraded: false };
  } catch (primaryError) {
    console.warn("Primary weather source failed:", primaryError.message);
    try {
      return { ...(await attempt(sources.backup, "MET Norway")), provider: "met-norway", degraded: true };
    } catch (backupError) {
      throw new Error(`All weather sources failed (${primaryError.message}; ${backupError.message})`);
    }
  }
}

const getForecast = (lat, lon) => memo("forecast", `${lat.toFixed(3)},${lon.toFixed(3)}`, 5 * 60000, () => loadForecast(lat, lon));

module.exports = { getForecast, loadForecast, checkSanity };
