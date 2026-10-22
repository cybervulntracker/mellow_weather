// Builds the complete weather payload the website shows for one place.
const { getForecast } = require("../providers");
const { getAirQuality, getClimate } = require("../providers/openmeteo");
const { describeCode } = require("../utils/conditions");
const { moonPhase, goldenHourOffsets } = require("../utils/astro");
const { getOfficialAlerts } = require("../providers/alerts");
const tomorrow = require("../providers/tomorrow");
const { addMinutes, minutesBetween } = require("../utils/time");
const { normalFor, compareToNormal } = require("../utils/climate");
const { buildAlerts, buildSummary, explainFeelsLike, buildRecommendations, buildNowcast } = require("../utils/insights");

const round = (n) => (n == null ? null : Math.round(n));

function aqiCategory(aqi) {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "veryUnhealthy";
  return "hazardous";
}

// Approximate grains/m3 bands
const pollenLevel = (v) => (v < 10 ? "low" : v < 50 ? "moderate" : v < 200 ? "high" : "veryHigh");

function buildAstro(f, now, place) {
  const today = f.daily[0];
  const moon = moonPhase(now);
  if (!today.sunrise || !today.sunset) return { sunrise: null, sunset: null, moon };

  const length = minutesBetween(today.sunrise, today.sunset);
  const elapsed = minutesBetween(today.sunrise, f.current.time);
  return {
    sunrise: today.sunrise,
    sunset: today.sunset,
    dayLengthMin: length,
    sunProgress: Math.min(1, Math.max(0, elapsed / length)),
    isDaylight: elapsed >= 0 && elapsed <= length,
    ...golden(today, place, now),
    moon,
  };
}

// Golden hour from the sun's real altitude; falls back to "first and last hour of sunlight" if the maths gives nothing
function golden(today, place, now) {
  const o = place && Number.isFinite(place.latitude) ? goldenHourOffsets(now, place.latitude, place.longitude) : null;
  if (!o) {
    return {
      goldenMorning: { start: today.sunrise, end: addMinutes(today.sunrise, 60) },
      goldenEvening: { start: addMinutes(today.sunset, -60), end: today.sunset },
    };
  }
  return {
    goldenMorning: { start: addMinutes(today.sunrise, -o.morningBeforeSunrise), end: addMinutes(today.sunrise, o.morningAfterSunrise) },
    goldenEvening: { start: addMinutes(today.sunset, -o.eveningBeforeSunset), end: addMinutes(today.sunset, o.eveningAfterSunset) },
  };
}

function buildPayload(place, f, air, climate, now = new Date(), extras = {}) {
  const c = f.current;
  const today = f.daily[0];
  const info = describeCode(c.code, c.isDay);
  const alerts = buildAlerts(f, air);
  const normal = climate ? normalFor(climate, today.date) : null;
  const visibility = f.hourly[0]?.visibilityM;

  return {
    city: place.name,
    admin1: place.admin1 || "",
    country: place.country || "",
    countryCode: place.countryCode || "",
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: f.timezone,
    localTime: c.time,
    provider: f.provider,
    degraded: f.degraded,

    temperature: round(c.temp),
    feelsLike: round(c.feels),
    humidity: round(c.humidity),
    wind: round(c.windKmh),
    windDirection: round(c.windDir),
    pressure: round(c.pressure),
    cloudCover: round(c.clouds),
    visibility: visibility != null ? Math.round(visibility / 100) / 10 : null,
    uvIndex: round(f.hourly[0]?.uv ?? today.uvMax),
    precipitation: f.hourly[0]?.precipProb ?? null,
    isDay: c.isDay,

    condition: info.condition,
    conditionKey: info.key,
    icon: info.icon,

    high: round(today.max),
    low: round(today.min),
    sunrise: today.sunrise,
    sunset: today.sunset,

    hourly: f.hourly.slice(0, 48).map((h) => ({
      time: h.time, icon: describeCode(h.code, h.isDay).icon, isDay: h.isDay, temp: round(h.temp), precip: h.precipProb ?? 0,
      feels: round(h.feels), humidity: round(h.humidity), wind: round(h.windKmh), pressure: round(h.pressure), clouds: round(h.clouds),
      rainMm: Math.round((h.precipMm || 0) * 10) / 10, uv: h.uv != null ? Math.round(h.uv * 10) / 10 : null,
    })),
    daily: f.daily.map((d) => ({
      date: d.date, wind: round(d.windMax), gust: round(d.gustMax), sunrise: d.sunrise, sunset: d.sunset, icon: describeCode(d.code, true).icon, conditionKey: describeCode(d.code, true).key,
      precip: d.precipProb ?? 0, rainMm: Math.round(d.precipSum * 10) / 10, low: round(d.min), high: round(d.max), uv: round(d.uvMax),
    })),

    air: air && {
      aqi: air.aqi, category: aqiCategory(air.aqi),
      pm25: round(air.pm25), pm10: round(air.pm10), o3: round(air.o3), no2: round(air.no2), so2: round(air.so2), co: round(air.co),
      pollen: { available: air.pollen.available, items: air.pollen.items.map((p) => ({ ...p, level: pollenLevel(p.value) })) },
    },
    nowcast: buildNowcast(f.minutely, f.minutelyStepMin || 15),
    astro: buildAstro(f, now, place),
    officialAlerts: extras.officialAlerts || [],
    pollenIndex: extras.pollenIndex || null,
    pressureTrend: pressureTrend(f),
    insights: {
      alerts,
      ...buildSummary(f, air),
      feelsLike: explainFeelsLike(c),
      recommendations: buildRecommendations(f, air, alerts),
      climate: compareToNormal(normal, today.max, today.min),
    },
  };
}

// Rising / steady / falling, from the next 6 hours of the pressure forecast (hPa)
function pressureTrend(f) {
  const a = f.hourly[0]?.pressure;
  const b = f.hourly[6]?.pressure;
  if (a == null || b == null) return null;
  const delta = Math.round((b - a) * 10) / 10;
  return { delta, direction: delta > 1 ? "rising" : delta < -1 ? "falling" : "steady" };
}

async function loadWeather(place, now = new Date()) {
  const [forecast, air, climate, official, minutely] = await Promise.all([
    getForecast(place.latitude, place.longitude),
    getAirQuality(place.latitude, place.longitude),
    getClimate(place.latitude, place.longitude).catch(() => null), // history is a bonus
    getOfficialAlerts(place.latitude, place.longitude).catch(() => []), // official warnings are a bonus
    tomorrow.enabled ? tomorrow.getExtras(place.latitude, place.longitude, forecast.timezone).catch(() => null) : null, // optional paid source
  ]);

  let f = forecast;
  if (minutely?.minutely?.length) f = { ...forecast, minutely: minutely.minutely, minutelyStepMin: 1 }; // true minute-by-minute rain
  return buildPayload(place, f, air, climate, now, { officialAlerts: official, pollenIndex: minutely?.pollenIndex || null });
}

// A small version for the compare page
const toCompact = (p) => ({
  city: p.city, admin1: p.admin1, country: p.country, latitude: p.latitude, longitude: p.longitude,
  temperature: p.temperature, feelsLike: p.feelsLike, humidity: p.humidity, wind: p.wind, precipitation: p.precipitation,
  uvIndex: p.uvIndex, aqi: p.air?.aqi ?? null, aqiCategory: p.air?.category ?? null, high: p.high, low: p.low,
  sunrise: p.sunrise, sunset: p.sunset, icon: p.icon, conditionKey: p.conditionKey, isDay: p.isDay,
  daily: p.daily.map((d) => ({ date: d.date, low: d.low, high: d.high, icon: d.icon })),
});

module.exports = { loadWeather, buildPayload, toCompact, aqiCategory };
