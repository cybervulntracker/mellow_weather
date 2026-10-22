// Open-Meteo: forecast, air quality, 10-year history and trends. Free, no key.
const { getJson } = require("../utils/http");
const { memo } = require("../utils/cache");

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

const coordKey = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

/* ---------------- forecast ---------------- */

function normalizeForecast(w) {
  const cur = w.current;
  const h = w.hourly;
  const d = w.daily;

  let start = h.time.findIndex((t) => t.startsWith(cur.time.slice(0, 13)));
  if (start < 0) start = 0;

  const hourly = h.time.slice(start, start + 48).map((time, i) => {
    const idx = start + i;
    return {
      time,
      temp: h.temperature_2m[idx],
      code: h.weather_code[idx],
      isDay: h.is_day[idx] === 1,
      precipProb: h.precipitation_probability[idx] ?? null,
      precipMm: h.precipitation?.[idx] ?? 0,
      visibilityM: h.visibility?.[idx] ?? null,
      uv: h.uv_index?.[idx] ?? null,
      feels: h.apparent_temperature?.[idx] ?? null,
      humidity: h.relative_humidity_2m?.[idx] ?? null,
      windKmh: h.wind_speed_10m?.[idx] ?? null,
      pressure: h.pressure_msl?.[idx] ?? null,
      clouds: h.cloud_cover?.[idx] ?? null,
    };
  });

  const daily = d.time.map((date, i) => ({
    date,
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    code: d.weather_code[i],
    precipProb: d.precipitation_probability_max?.[i] ?? null,
    precipSum: d.precipitation_sum?.[i] ?? 0,
    sunrise: d.sunrise?.[i] ?? null,
    sunset: d.sunset?.[i] ?? null,
    uvMax: d.uv_index_max?.[i] ?? null,
    windMax: d.wind_speed_10m_max?.[i] ?? null,
    gustMax: d.wind_gusts_10m_max?.[i] ?? null,
  }));

  // 15-minute rain amounts, starting from the current quarter hour
  let minutely = [];
  if (w.minutely_15?.time) {
    const mins = Number(cur.time.slice(14, 16));
    const slot = `${cur.time.slice(0, 14)}${String(Math.floor(mins / 15) * 15).padStart(2, "0")}`;
    const first = Math.max(0, w.minutely_15.time.findIndex((t) => t >= slot));
    minutely = w.minutely_15.time.slice(first, first + 8).map((time, i) => ({ time, mm: w.minutely_15.precipitation[first + i] ?? 0 }));
  }

  return {
    timezone: w.timezone,
    current: {
      time: cur.time,
      temp: cur.temperature_2m,
      feels: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      isDay: cur.is_day === 1,
      code: cur.weather_code,
      clouds: cur.cloud_cover,
      pressure: cur.pressure_msl,
      windKmh: cur.wind_speed_10m,
      windDir: cur.wind_direction_10m,
      gustKmh: cur.wind_gusts_10m ?? null,
    },
    hourly,
    daily,
    minutely,
  };
}

async function fetchForecast(lat, lon) {
  const url = `${FORECAST}?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
    "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility,uv_index,is_day,apparent_temperature,relative_humidity_2m,wind_speed_10m,pressure_msl,cloud_cover" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max" +
    "&minutely_15=precipitation&timezone=auto&forecast_days=7";
  return normalizeForecast(await getJson(url));
}

/* ---------------- air quality + pollen ---------------- */

const POLLEN_KEYS = ["alder", "birch", "grass", "mugwort", "olive", "ragweed"];

function normalizeAir(data) {
  const c = data?.current;
  if (!c || c.us_aqi == null) return null;
  const items = POLLEN_KEYS.filter((k) => c[`${k}_pollen`] != null).map((k) => ({ key: k, value: Math.round(c[`${k}_pollen`]) }));
  return {
    aqi: Math.round(c.us_aqi),
    pm25: c.pm2_5, pm10: c.pm10, o3: c.ozone, no2: c.nitrogen_dioxide, so2: c.sulphur_dioxide, co: c.carbon_monoxide,
    pollen: { available: items.length > 0, items }, // pollen data only exists for Europe
  };
}

// Never throws: air quality is a bonus, the forecast must still work without it.
async function getAirQuality(lat, lon) {
  try {
    return await memo("air", coordKey(lat, lon), 15 * 60000, async () => {
      const url = `${AIR}?latitude=${lat}&longitude=${lon}&timezone=auto` +
        "&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide," +
        POLLEN_KEYS.map((k) => `${k}_pollen`).join(",");
      return normalizeAir(await getJson(url));
    });
  } catch (error) {
    console.warn("Air quality unavailable:", error.message);
    return null;
  }
}

/* ---------------- history: 10 years of daily data, for "normal for this date" ---------------- */

function getClimate(lat, lon) {
  return memo("climate", `${lat.toFixed(2)},${lon.toFixed(2)}`, 30 * 86400000, async () => {
    const year = new Date().getUTCFullYear();
    const url = `${ARCHIVE}?latitude=${lat}&longitude=${lon}&start_date=${year - 10}-01-01&end_date=${year - 1}-12-31` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto";
    const daily = (await getJson(url, 20000)).daily;
    return { dates: daily.time, tmax: daily.temperature_2m_max, tmin: daily.temperature_2m_min, precip: daily.precipitation_sum };
  }, 100);
}

/* ---------------- trends (last 30 days) and 16-day range (trip planner) ---------------- */

function getTrends(lat, lon) {
  return memo("trends", coordKey(lat, lon), 60 * 60000, async () => {
    const url = `${FORECAST}?latitude=${lat}&longitude=${lon}&past_days=30&forecast_days=1&timezone=auto` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum";
    const d = (await getJson(url)).daily;
    return d.time.map((date, i) => ({ date, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], precip: d.precipitation_sum[i] ?? 0 }));
  });
}

function getDailyRange(lat, lon) {
  return memo("range", coordKey(lat, lon), 30 * 60000, async () => {
    const url = `${FORECAST}?latitude=${lat}&longitude=${lon}&forecast_days=16&timezone=auto` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code";
    const d = (await getJson(url)).daily;
    return d.time.map((date, i) => ({
      date, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], code: d.weather_code[i],
      precipProb: d.precipitation_probability_max?.[i] ?? null, precipSum: d.precipitation_sum?.[i] ?? 0,
    }));
  });
}

module.exports = { fetchForecast, normalizeForecast, normalizeAir, getAirQuality, getClimate, getTrends, getDailyRange };
