const test = require("node:test");
const assert = require("node:assert");
const { rankPlaces } = require("../utils/geo");
const { normalizeForecast, normalizeAir } = require("../providers/openmeteo");
const { normalizeMetno, symbolToWmo } = require("../providers/metno");
const { loadForecast, checkSanity } = require("../providers");
const { buildAlerts, buildSummary, explainFeelsLike, buildRecommendations, buildNowcast } = require("../utils/insights");
const { buildPayload, aqiCategory } = require("../services/weatherService");
const { openMeteoResponse, metnoResponse } = require("./fixtures");

const place = (o) => ({ admin1: "", country: "", countryCode: "", population: 0, featureCode: "PPL", latitude: 0, longitude: 0, ...o });

/* ---------------- place search: the "Gujarat in Nepal" family of bugs ---------------- */

test("Gujarat resolves to the Indian state, not a tiny village in Nepal", () => {
  const openMeteo = [place({ name: "Gujarat", admin1: "Bagmati", country: "Nepal", countryCode: "NP", latitude: 27.9, longitude: 85.1 })];
  const photon = [place({ name: "Gujarat", country: "India", countryCode: "IN", latitude: 22.3, longitude: 71.7, featureCode: "ADM1" })];
  for (const order of [[openMeteo, photon], [photon, openMeteo]]) {
    const { results } = rankPlaces(order, "Gujarat");
    assert.strictEqual(results[0].countryCode, "IN");
    assert.strictEqual(results[0].label, "Gujarat, India");
  }
});

test("Delhi resolves to the big Indian city and is not flagged ambiguous", () => {
  const { results, ambiguous } = rankPlaces([
    [place({ name: "Delhi", admin1: "Delhi", country: "India", countryCode: "IN", population: 11034555, featureCode: "PPLA", latitude: 28.65, longitude: 77.23 }),
     place({ name: "New Delhi", admin1: "Delhi", country: "India", countryCode: "IN", population: 249998, featureCode: "PPLC", latitude: 28.6, longitude: 77.2 }),
     place({ name: "Delhi", admin1: "Louisiana", country: "United States", countryCode: "US", population: 2500, latitude: 32.4, longitude: -91.5 })],
    [place({ name: "Delhi", country: "India", countryCode: "IN", latitude: 28.66, longitude: 77.22, featureCode: "ADM1" })],
  ], "Delhi");
  assert.strictEqual(results[0].countryCode, "IN");
  assert.strictEqual(results[0].population, 11034555);
  assert.strictEqual(ambiguous, false);
  assert.strictEqual(results.filter((r) => r.name === "Delhi" && r.countryCode === "IN").length, 1, "same place from both sources is merged");
});

test("Paris is France, but Springfield and Hyderabad ask the person to choose", () => {
  const paris = rankPlaces([[
    place({ name: "Paris", admin1: "Île-de-France", country: "France", countryCode: "FR", population: 2138551, featureCode: "PPLC", latitude: 48.85, longitude: 2.35 }),
    place({ name: "Paris", admin1: "Texas", country: "United States", countryCode: "US", population: 25171, featureCode: "PPLA2", latitude: 33.66, longitude: -95.55 }),
  ]], "Paris");
  assert.strictEqual(paris.results[0].countryCode, "FR");
  assert.strictEqual(paris.ambiguous, false);

  const springfield = rankPlaces([[
    place({ name: "Springfield", admin1: "Illinois", country: "United States", countryCode: "US", population: 116250, featureCode: "PPLA2", latitude: 39.8, longitude: -89.6 }),
    place({ name: "Springfield", admin1: "Missouri", country: "United States", countryCode: "US", population: 169176, featureCode: "PPLA2", latitude: 37.2, longitude: -93.3 }),
  ]], "Springfield");
  assert.strictEqual(springfield.ambiguous, true);

  const hyderabad = rankPlaces([[
    place({ name: "Hyderabad", admin1: "Telangana", country: "India", countryCode: "IN", population: 6809970, featureCode: "PPLA", latitude: 17.38, longitude: 78.48 }),
    place({ name: "Hyderabad", admin1: "Sindh", country: "Pakistan", countryCode: "PK", population: 1732693, featureCode: "PPLA2", latitude: 25.39, longitude: 68.37 }),
  ]], "Hyderabad");
  assert.strictEqual(hyderabad.results[0].countryCode, "IN");
  assert.strictEqual(hyderabad.ambiguous, true);
});

test("labels show city, state and country; places with no results give an empty list", () => {
  const { results } = rankPlaces([[place({ name: "Surat", admin1: "Gujarat", country: "India", countryCode: "IN", population: 4467797, featureCode: "PPLA2" })]], "surat");
  assert.strictEqual(results[0].label, "Surat, Gujarat, India");
  assert.deepStrictEqual(rankPlaces([[], []], "zzzz"), { results: [], ambiguous: false });
});

/* ---------------- provider normalising, sanity checks and fallback ---------------- */

test("Open-Meteo answers are normalised: hourly starts at the current hour, rain slots start now", () => {
  const f = normalizeForecast(openMeteoResponse({ now: "2026-10-12T14:15" }));
  assert.strictEqual(f.current.time, "2026-10-12T14:15");
  assert.strictEqual(f.hourly[0].time, "2026-10-12T14:00");
  assert.strictEqual(f.hourly.length, 48);
  assert.strictEqual(f.daily.length, 7);
  assert.strictEqual(f.minutely[0].time, "2026-10-12T14:15");
  assert.strictEqual(f.minutely.length, 8);
  assert.deepStrictEqual(checkSanity(f), []);
});

test("air quality: AQI categories, and pollen is marked unavailable outside Europe", () => {
  const delhi = normalizeAir({ current: { us_aqi: 182.4, pm2_5: 98, pm10: 160, ozone: 40, nitrogen_dioxide: 30, sulphur_dioxide: 12, carbon_monoxide: 600, alder_pollen: null, birch_pollen: null } });
  assert.strictEqual(delhi.aqi, 182);
  assert.strictEqual(delhi.pollen.available, false);
  const berlin = normalizeAir({ current: { us_aqi: 40, birch_pollen: 120, grass_pollen: 3 } });
  assert.deepStrictEqual(berlin.pollen.items.map((p) => p.key), ["birch", "grass"]);
  assert.strictEqual(normalizeAir({ current: { us_aqi: null } }), null);
  assert.strictEqual(normalizeAir({}), null);
  assert.deepStrictEqual([50, 100, 150, 200, 300, 301].map(aqiCategory), ["good", "moderate", "sensitive", "unhealthy", "veryUnhealthy", "hazardous"]);
});

test("MET Norway answers are normalised into the same shape, in the place's own timezone", () => {
  const f = normalizeMetno(metnoResponse({ startUtc: "2026-10-12T08:00:00Z" }), 28.61, 77.21);
  assert.strictEqual(f.timezone, "Asia/Kolkata");
  assert.strictEqual(f.current.time, "2026-10-12T13:30");
  assert.strictEqual(f.hourly.length, 48);
  assert.ok(f.daily.length >= 3 && f.daily.every((d) => d.max >= d.min && d.sunrise && d.sunset));
  assert.strictEqual(f.hourly[0].code, 61); // first hour has "lightrain"
  assert.deepStrictEqual(checkSanity(f), []);
  assert.ok(f.current.feels < f.current.temp + 5);
  assert.deepStrictEqual(["clearsky_day", "rainandthunder", "heavysnow", "fog", "mystery"].map(symbolToWmo), [0, 95, 75, 45, 3]);
});

test("sanity check rejects impossible values", () => {
  const good = normalizeForecast(openMeteoResponse());
  const bad = (patch) => checkSanity({ ...good, current: { ...good.current, ...patch } });
  assert.ok(bad({ temp: 400 }).length);
  assert.ok(bad({ humidity: 140 }).length);
  assert.ok(bad({ pressure: 300 }).length);
  assert.ok(bad({ temp: NaN }).length);
  assert.ok(checkSanity({ ...good, hourly: good.hourly.slice(0, 5) }).length);
  assert.ok(checkSanity({ ...good, daily: good.daily.map((d) => ({ ...d, max: 1, min: 9 })) }).length);
  assert.deepStrictEqual(checkSanity({}), ["no current conditions"]);
});

test("falls back to MET Norway when Open-Meteo fails or sends nonsense, and fails loudly when both do", async () => {
  const good = normalizeForecast(openMeteoResponse());
  const backup = { fetchForecast: async () => normalizeMetno(metnoResponse(), 28.61, 77.21) };
  const ok = { fetchForecast: async () => good };
  const down = { fetchForecast: async () => { throw new Error("HTTP 500"); } };
  const insane = { fetchForecast: async () => ({ ...good, current: { ...good.current, temp: 999 } }) };
  const warn = console.warn; console.warn = () => {};
  try {
    const a = await loadForecast(0, 0, { primary: ok, backup });
    assert.strictEqual(a.provider, "open-meteo"); assert.strictEqual(a.degraded, false);
    const b = await loadForecast(0, 0, { primary: down, backup });
    assert.strictEqual(b.provider, "met-norway"); assert.strictEqual(b.degraded, true);
    const c = await loadForecast(0, 0, { primary: insane, backup });
    assert.strictEqual(c.provider, "met-norway");
    await assert.rejects(loadForecast(0, 0, { primary: down, backup: insane }), /All weather sources failed/);
  } finally { console.warn = warn; }
});

/* ---------------- alerts, summary, advice ---------------- */

const forecast = (opts) => normalizeForecast(openMeteoResponse(opts));

test("alerts: heat, storm, heavy rain, wind, air - strongest per type, most severe first", () => {
  const f = forecast({ daily: { temperature_2m_max: [46, 41, 39, 33, 33, 33, 33], precipitation_sum: [70, 130, 0, 0, 0, 0, 0], weather_code: [2, 95, 2, 2, 2, 2, 2], wind_gusts_10m_max: [80, 30, 30, 30, 30, 30, 30] } });
  const alerts = buildAlerts(f, { aqi: 320 });
  const byType = Object.fromEntries(alerts.map((a) => [a.type, a]));
  assert.strictEqual(byType.heat.severity, "severe");
  assert.strictEqual(byType.rain.severity, "severe");
  assert.strictEqual(byType.rain.value, 130);
  assert.strictEqual(byType.storm.severity, "warning");
  assert.strictEqual(byType.wind.severity, "warning");
  assert.strictEqual(byType.air.severity, "severe");
  assert.strictEqual(alerts.filter((a) => a.type === "heat").length, 1);
  assert.ok(alerts.every((a, i) => i === 0 || ["severe", "warning", "watch"].indexOf(alerts[i - 1].severity) <= ["severe", "warning", "watch"].indexOf(a.severity)));
  assert.deepStrictEqual(buildAlerts(forecast(), { aqi: 60 }), []);
});

test("alerts: cold and fog", () => {
  const f = forecast({ daily: { temperature_2m_min: [-12, 1, 1, 1, 1, 1, 1] } });
  assert.strictEqual(buildAlerts(f, null).find((a) => a.type === "cold").severity, "warning");
  const foggy = normalizeForecast(openMeteoResponse());
  foggy.hourly[0].visibilityM = 400;
  assert.ok(buildAlerts(foggy, null).some((a) => a.type === "fog"));
});

test("summary says when rain starts, when it stops, or that it stays dry; tips follow the data", () => {
  const dry = buildSummary(forecast(), null);
  assert.strictEqual(dry.sentences[0].key, "dryAhead");
  assert.strictEqual(dry.sentences[1].params.high, 33);

  const f = forecast();
  f.hourly[5].precipProb = 80; f.hourly[5].precipMm = 2;
  const soon = buildSummary(f, { aqi: 180 });
  assert.strictEqual(soon.sentences[0].key, "rainAt");
  assert.strictEqual(soon.sentences[0].params.time, f.hourly[5].time);
  assert.ok(soon.tips.includes("umbrella") && soon.tips.includes("mask"));

  const raining = forecast({ code: 63 });
  raining.hourly.forEach((h, i) => { if (i >= 3) { h.precipProb = 0; h.precipMm = 0; h.code = 1; } });
  const ends = buildSummary(raining, null);
  assert.strictEqual(ends.sentences[0].key, "rainNowEndsAt");
  assert.strictEqual(ends.sentences[0].params.time, raining.hourly[3].time);
});

test("feels-like explanation names the real reason", () => {
  assert.strictEqual(explainFeelsLike({ temp: 30, feels: 31, humidity: 50, windKmh: 10 }).reasons[0].key, "similar");
  assert.strictEqual(explainFeelsLike({ temp: 32, feels: 38, humidity: 75, windKmh: 3 }).reasons[0].key, "humid");
  assert.strictEqual(explainFeelsLike({ temp: 10, feels: 5, humidity: 50, windKmh: 25 }).reasons[0].key, "windChill");
});

test("recommendations: running, laundry, travel, outdoors react to weather and air", () => {
  const rec = (f, air = null, alerts = []) => Object.fromEntries(buildRecommendations(f, air, alerts).map((r) => [r.activity, r]));
  const calm = rec(forecast({ temp: 24 }), { aqi: 40 });
  assert.strictEqual(calm.running.rating, "good");
  assert.strictEqual(calm.travel.rating, "good");

  const smoggy = rec(forecast({ temp: 24 }), { aqi: 260 });
  assert.strictEqual(smoggy.running.rating, "poor");
  assert.ok(smoggy.running.reasons.includes("airBad"));
  assert.strictEqual(smoggy.travel.rating, "fair");

  const wet = forecast({ code: 63, precipProb: 90, rainMm: 3 });
  const rainy = rec(wet, null, [{ type: "storm", severity: "warning" }]);
  assert.strictEqual(rainy.laundry.rating, "poor");
  assert.strictEqual(rainy.travel.rating, "poor");
  assert.strictEqual(rainy.outdoors.rating, "poor");

  const hot = forecast({ temp: 40 });
  assert.strictEqual(rec(hot).running.rating, "poor");
});

test("nowcast: dry, raining now (with end time), rain soon", () => {
  const slot = (mm) => ({ time: "t", mm });
  assert.strictEqual(buildNowcast([]), null);
  assert.strictEqual(buildNowcast(null), null);
  assert.deepStrictEqual(buildNowcast([slot(0), slot(0)]).status, "dry");
  const soon = buildNowcast([slot(0), slot(0), slot(0.6), slot(0)]);
  assert.strictEqual(soon.status, "rainSoon"); assert.strictEqual(soon.minutes, 30); assert.strictEqual(soon.intensity, "moderate");
  const now = buildNowcast([slot(3), slot(1), slot(0)]);
  assert.strictEqual(now.status, "raining"); assert.strictEqual(now.minutes, 30); assert.strictEqual(now.intensity, "heavy");
  assert.strictEqual(buildNowcast([slot(1), slot(1)]).minutes, null);
});

/* ---------------- the full payload ---------------- */

test("payload is complete for Open-Meteo data", () => {
  const f = { ...forecast({ now: "2026-10-12T14:15" }), provider: "open-meteo", degraded: false };
  const p = buildPayload({ name: "New Delhi", admin1: "Delhi", country: "India", countryCode: "IN", latitude: 28.6, longitude: 77.2 }, f, { aqi: 182, pm25: 98, pm10: 160, o3: 40, no2: 30, so2: 12, co: 600, pollen: { available: false, items: [] } }, null, new Date("2026-10-12T09:00:00Z"));
  assert.strictEqual(p.city, "New Delhi"); assert.strictEqual(p.admin1, "Delhi");
  assert.strictEqual(p.hourly.length, 48); assert.strictEqual(p.daily.length, 7);
  assert.strictEqual(p.hourly[0].time, "2026-10-12T14:00");
  assert.strictEqual(p.air.category, "unhealthy");
  assert.strictEqual(p.astro.isDaylight, true);
  assert.ok(p.astro.sunProgress > 0.5 && p.astro.sunProgress < 0.8);
  // golden hour now follows the sun's altitude: it starts before sunset and ends after it, and mirrors that in the morning
  assert.ok(p.astro.goldenEvening.start < p.sunset && p.astro.goldenEvening.end > p.sunset);
  assert.ok(p.astro.goldenMorning.start < p.sunrise && p.astro.goldenMorning.end > p.sunrise);
  assert.ok(p.astro.moon.phase && p.astro.moon.illumination >= 0);
  assert.strictEqual(p.nowcast.status, "dry");
  assert.strictEqual(p.insights.climate, null);
  assert.strictEqual(p.insights.recommendations.length, 4);
  assert.strictEqual(p.visibility, 24.1);
  assert.strictEqual(p.conditionKey, "partlyCloudy");
  JSON.stringify(p); // must be serialisable
});

test("payload still works with the degraded MET Norway data (no UV, no air quality, no rain slots)", () => {
  const f = { ...normalizeMetno(metnoResponse(), 28.61, 77.21), provider: "met-norway", degraded: true };
  const p = buildPayload({ name: "Delhi", latitude: 28.61, longitude: 77.21 }, f, null, null, new Date("2026-10-12T09:00:00Z"));
  assert.strictEqual(p.degraded, true); assert.strictEqual(p.provider, "met-norway");
  assert.strictEqual(p.air, null); assert.strictEqual(p.nowcast, null); assert.strictEqual(p.uvIndex, null); assert.strictEqual(p.visibility, null);
  assert.ok(p.daily.length >= 3 && p.hourly.length >= 24);
  assert.ok(p.astro.sunrise && p.astro.sunset);
});
