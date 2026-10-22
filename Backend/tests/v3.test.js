const test = require("node:test");
const assert = require("node:assert");
const { goldenHourOffsets, sunTimes } = require("../utils/astro");
const { parseNws, inUS } = require("../providers/alerts");
const { parseTomorrow } = require("../providers/tomorrow");
const { renderLine, subjectFor } = require("../utils/messages");
const { buildNowcast } = require("../utils/insights");
const { fromGeoapify } = require("../utils/geo");
const { buildPayload } = require("../services/weatherService");
const { openMeteoResponse } = require("./fixtures");
const { normalizeForecast } = require("../providers/openmeteo");

test("golden hour comes from the sun's altitude and is longer than the old fixed hour at high latitudes", () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 12));
  const delhi = goldenHourOffsets(noon, 28.6, 77.2);
  const oslo = goldenHourOffsets(noon, 59.9, 10.7);
  assert.ok(delhi.eveningBeforeSunset > 30 && delhi.eveningBeforeSunset < 90, "Delhi evening golden hour is about an hour");
  assert.ok(oslo.eveningBeforeSunset > delhi.eveningBeforeSunset, "the sun lingers at low angles further north");
  assert.ok(sunTimes(noon, 28.6, 77.2).sunset > sunTimes(noon, 28.6, 77.2, 6).sunset, "sun passes 6° before it sets");
});

test("golden hour is skipped near the poles instead of throwing", () => {
  assert.strictEqual(goldenHourOffsets(new Date(Date.UTC(2026, 5, 21)), 80, 0), null);
});

test("NWS alerts are turned into small objects and limited to five", () => {
  const features = Array.from({ length: 7 }, (_, i) => ({ properties: { event: `Heat Advisory ${i}`, severity: "Severe", headline: "h", description: "a\n\n b", onset: "2026-07-01T10:00:00-05:00", areaDesc: "Cook" } }));
  features.push({ properties: {} });
  const parsed = parseNws({ features });
  assert.strictEqual(parsed.length, 5);
  assert.strictEqual(parsed[0].severity, "severe");
  assert.strictEqual(parsed[0].description, "a b");
});

test("official alerts are only requested for places inside the US", () => {
  assert.ok(inUS(40.7, -74));
  assert.ok(!inUS(28.6, 77.2));
});

test("Tomorrow.io minutes become local-time slots on the same scale as the 15-minute data", () => {
  const now = new Date("2026-10-12T08:45:00Z");
  const data = { timelines: { minutely: [0, 1, 2].map((i) => ({ time: new Date(now.getTime() + i * 60000).toISOString(), values: { precipitationIntensity: i === 0 ? 0 : 2 } })), hourly: [{ values: { treeIndex: 3, grassIndex: 1 } }] } };
  const out = parseTomorrow(data, "Asia/Kolkata", now);
  assert.strictEqual(out.minutely[0].time, "2026-10-12T14:15");
  assert.strictEqual(out.minutely[1].mm, 0.5);
  assert.deepStrictEqual(out.pollenIndex.items.map((i) => i.key), ["tree", "grass"]);
});

test("nowcast minutes use the step of the data (1-minute data)", () => {
  const slots = [0, 0, 0, 1, 1].map((mm, i) => ({ time: String(i), mm }));
  const n = buildNowcast(slots, 1);
  assert.strictEqual(n.status, "rainSoon");
  assert.strictEqual(n.minutes, 3);
});

test("Hindi wording exists for every line the scheduler can send", () => {
  const lines = [
    { key: "rainNowAllDay" }, { key: "dryAhead" }, { key: "rainAt", params: { time: "2026-10-12T16:00" } },
    { key: "rainNowEndsAt", params: { time: "2026-10-12T16:30" } }, { key: "highToday", params: { high: 33 } },
    { key: "tips", params: { list: ["umbrella", "mask"] } }, { key: "rainTomorrowLine", params: { prob: 80, mm: 5 } },
    { key: "rule_aqi", params: { value: 180, threshold: 150 } }, { key: "supportReplyLine", params: { subject: "Hi" } },
  ];
  for (const line of lines) {
    const hi = renderLine(line, "hi");
    const en = renderLine(line, "en");
    assert.ok(hi && en, line.key);
    assert.notStrictEqual(hi, en, `${line.key} should differ between languages`);
  }
  assert.ok(/[\u0900-\u097F]/.test(subjectFor("digest", "hi")));
  assert.strictEqual(renderLine({ key: "dryAhead" }, "xx"), renderLine({ key: "dryAhead" }, "en"), "unknown languages fall back to English");
});

test("Geoapify results map to the shared place shape", () => {
  const p = fromGeoapify({ properties: { lat: 1, lon: 2, city: "Testville", state: "State", country: "Land", country_code: "tl", result_type: "city" } });
  assert.deepStrictEqual([p.name, p.admin1, p.countryCode, p.latitude], ["Testville", "State", "TL", 1]);
  assert.strictEqual(fromGeoapify({ properties: {} }), null);
});

test("payload carries the richer hourly values, pressure trend and optional extras", () => {
  const f = { ...normalizeForecast(openMeteoResponse()), provider: "open-meteo", degraded: false };
  const payload = buildPayload({ name: "Delhi", latitude: 28.6, longitude: 77.2 }, f, null, null, new Date("2026-10-12T08:45:00Z"), { officialAlerts: [{ event: "x" }] });
  assert.ok("humidity" in payload.hourly[0] && "wind" in payload.hourly[0]);
  assert.strictEqual(payload.officialAlerts.length, 1);
  assert.ok(payload.astro.goldenEvening.start < payload.astro.goldenEvening.end);
  assert.strictEqual(payload.pollenIndex, null);
});
