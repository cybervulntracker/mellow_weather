// Realistic fake API answers shared by the tests.
const pad = (n) => String(n).padStart(2, "0");

// Open-Meteo style forecast response (local times, 7 days hourly)
function openMeteoResponse({ now = "2026-10-12T14:15", temp = 31.4, code = 2, hourlyCode, precipProb = 10, rainMm = 0, daily = {}, minutely = true } = {}) {
  const [date] = now.split("T");
  const start = Date.UTC(...date.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))), 0, 0);
  const time = [], hc = [], temps = [], prob = [], mm = [], vis = [], uv = [], isDay = [];
  for (let i = 0; i < 7 * 24; i++) {
    const d = new Date(start + i * 3600000);
    time.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`);
    hc.push(hourlyCode ?? code); temps.push(20 + (i % 12)); prob.push(precipProb); mm.push(rainMm);
    vis.push(24140); uv.push(d.getUTCHours() === 12 ? 8 : 3); isDay.push(d.getUTCHours() >= 6 && d.getUTCHours() < 18 ? 1 : 0);
  }
  const days = Array.from({ length: 7 }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
  const res = {
    timezone: "Asia/Kolkata",
    current: { time: now, temperature_2m: temp, apparent_temperature: temp + 2, relative_humidity_2m: 55, is_day: 1, weather_code: code, cloud_cover: 40, pressure_msl: 1008, wind_speed_10m: 12, wind_direction_10m: 270, wind_gusts_10m: 25 },
    hourly: { time, weather_code: hc, temperature_2m: temps, precipitation_probability: prob, precipitation: mm, visibility: vis, uv_index: uv, is_day: isDay },
    daily: {
      time: days, temperature_2m_max: days.map((_, i) => 33 - i), temperature_2m_min: days.map((_, i) => 24 - i), precipitation_probability_max: days.map(() => 20),
      precipitation_sum: days.map(() => 0), weather_code: days.map(() => 2), sunrise: days.map((d) => `${d}T06:19`), sunset: days.map((d) => `${d}T17:57`),
      uv_index_max: days.map(() => 7), wind_speed_10m_max: days.map(() => 15), wind_gusts_10m_max: days.map(() => 30), ...daily,
    },
  };
  if (minutely) {
    const mt = [], mp = [];
    for (let i = 0; i < 96; i++) { const d = new Date(start + i * 900000); mt.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`); mp.push(0); }
    res.minutely_15 = { time: mt, precipitation: mp };
  }
  return res;
}

// MET Norway style response: hourly for 48h, then every 6 hours
function metnoResponse({ startUtc = "2026-10-12T08:00:00Z", temp = 30 } = {}) {
  const t0 = Date.parse(startUtc);
  const timeseries = [];
  for (let i = 0; i < 56; i++) {
    const hourly = i < 48;
    const at = new Date(t0 + (hourly ? i * 3600000 : 48 * 3600000 + (i - 48) * 6 * 3600000));
    const entry = {
      time: at.toISOString().replace(".000", ""),
      data: { instant: { details: { air_temperature: temp + (i % 5), relative_humidity: 60, wind_speed: 3, wind_from_direction: 200, air_pressure_at_sea_level: 1005, cloud_area_fraction: 30 } }, next_6_hours: { summary: { symbol_code: "partlycloudy_day" }, details: { precipitation_amount: 0.4 } } },
    };
    if (hourly) entry.data.next_1_hours = { summary: { symbol_code: i % 7 === 0 ? "lightrain" : "partlycloudy_day" }, details: { precipitation_amount: i % 7 === 0 ? 0.6 : 0 } };
    timeseries.push(entry);
  }
  return { properties: { timeseries } };
}

module.exports = { openMeteoResponse, metnoResponse };
