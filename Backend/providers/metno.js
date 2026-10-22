// MET Norway (Locationforecast 2.0): a second, independent weather source.
// Used automatically when Open-Meteo fails or returns impossible numbers.
// It has no UV index, visibility or rain probability, so those are left empty or estimated.
const tzlookup = require("tz-lookup");
const { getJson } = require("../utils/http");
const { localParts } = require("../utils/time");
const { sunTimes } = require("../utils/astro");

// MET symbol names -> the WMO weather codes the rest of the app understands
function symbolToWmo(symbol) {
  if (!symbol) return 3;
  const base = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (base.includes("thunder")) return 95;
  const table = {
    clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
    lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
    lightsleet: 67, sleet: 67, heavysleet: 67, lightsleetshowers: 67, sleetshowers: 67, heavysleetshowers: 67,
    lightsnow: 71, snow: 73, heavysnow: 75, lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86,
  };
  return table[base] ?? 3;
}

// How "bad" a code is, so a day shows its worst weather
const severity = (code) => (code >= 95 ? 6 : (code >= 71 && code <= 77) || code >= 85 ? 5 : code >= 51 ? 4 : code >= 45 ? 3 : code === 3 ? 2 : code >= 1 ? 1 : 0);

// Feels-like temperature (Australian Bureau of Meteorology formula)
function apparentTemperature(tempC, humidity, windMs) {
  const vapour = (humidity / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return Math.round((tempC + 0.33 * vapour - 0.7 * windMs - 4) * 10) / 10;
}

// MET gives no rain probability; estimate it from the forecast amount
const probabilityFromMm = (mm) => (mm == null ? null : mm >= 1 ? 85 : mm >= 0.2 ? 60 : mm > 0 ? 35 : 10);

function normalizeMetno(json, lat, lon) {
  const tz = tzlookup(lat, lon);
  const entries = json.properties.timeseries.map((e) => {
    const local = localParts(new Date(e.time), tz);
    const details = e.data.instant.details;
    const next1 = e.data.next_1_hours;
    const next6 = e.data.next_6_hours;
    const symbol = (next1 || next6 || e.data.next_12_hours)?.summary?.symbol_code ?? null;
    return {
      local: local.iso, date: local.date, symbol, hasHourly: Boolean(next1),
      temp: details.air_temperature, humidity: details.relative_humidity, windMs: details.wind_speed ?? 0,
      windDir: details.wind_from_direction ?? 0, pressure: details.air_pressure_at_sea_level, clouds: details.cloud_area_fraction ?? 0,
      mm1: next1?.details?.precipitation_amount ?? null, mm6: next6?.details?.precipitation_amount ?? null,
      utc: new Date(e.time),
    };
  });

  const isDayAt = (e) => {
    if (e.symbol?.endsWith("_day")) return true;
    if (e.symbol?.endsWith("_night")) return false;
    const sun = sunTimes(e.utc, lat, lon);
    return sun ? e.utc >= sun.sunrise && e.utc <= sun.sunset : true;
  };

  const first = entries[0];
  const current = {
    time: first.local, temp: first.temp, feels: apparentTemperature(first.temp, first.humidity, first.windMs),
    humidity: first.humidity, isDay: isDayAt(first), code: symbolToWmo(first.symbol), clouds: first.clouds,
    pressure: first.pressure, windKmh: Math.round(first.windMs * 36) / 10, windDir: first.windDir, gustKmh: null,
  };

  const hourly = entries.filter((e) => e.hasHourly).slice(0, 48).map((e) => ({
    time: e.local, temp: e.temp, code: symbolToWmo(e.symbol), isDay: isDayAt(e),
    precipProb: probabilityFromMm(e.mm1), precipMm: e.mm1 ?? 0, visibilityM: null, uv: null,
  }));

  const byDate = new Map();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  const daily = [...byDate.entries()].slice(0, 7).map(([date, list]) => {
    const temps = list.map((e) => e.temp);
    const precipSum = list.reduce((sum, e) => sum + (e.hasHourly ? e.mm1 ?? 0 : e.mm6 ?? 0), 0);
    const code = list.map((e) => symbolToWmo(e.symbol)).reduce((worst, c) => (severity(c) > severity(worst) ? c : worst), 0);
    const sun = sunTimes(new Date(`${date}T12:00:00Z`), lat, lon);
    return {
      date, max: Math.max(...temps), min: Math.min(...temps), code,
      precipProb: probabilityFromMm(precipSum / 4), precipSum: Math.round(precipSum * 10) / 10,
      sunrise: sun ? localParts(sun.sunrise, tz).iso : null, sunset: sun ? localParts(sun.sunset, tz).iso : null,
      uvMax: null, windMax: Math.round(Math.max(...list.map((e) => e.windMs)) * 36) / 10, gustMax: null,
    };
  });

  return { timezone: tz, current, hourly, daily, minutely: [] };
}

async function fetchForecast(lat, lon) {
  // MET asks for at most 4 decimals in coordinates
  const la = lat.toFixed(4), lo = lon.toFixed(4);
  const json = await getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${la}&lon=${lo}`);
  return normalizeMetno(json, Number(la), Number(lo));
}

module.exports = { fetchForecast, normalizeMetno, symbolToWmo };
