// Checks the REAL outside services from your own machine (they can't be reached from some networks).
//   npm run check:apis
// It uses the same code the app uses, so a pass here means the app will behave the same way.
const { searchPlaces } = require("../utils/geo");
const openMeteo = require("../providers/openmeteo");
const metno = require("../providers/metno");
const { checkSanity } = require("../providers");

let failures = 0, warnings = 0;
const show = (status, text) => {
  if (status === "FAIL") failures++;
  if (status === "WARN") warnings++;
  console.log(`${{ PASS: "✓", WARN: "!", FAIL: "✗" }[status]} ${status.padEnd(4)} ${text}`);
};
const attempt = async (label, fn) => {
  try { return await fn(); } catch (error) { show("FAIL", `${label}: ${error.message}`); return null; }
};

// [name typed, country we expect first] — includes the kind of names that used to go wrong
const PLACES = [["Gujarat", "IN"], ["Delhi", "IN"], ["Mumbai", "IN"], ["Kathmandu", "NP"], ["Paris", "FR"], ["London", "GB"], ["Tokyo", "JP"], ["Sydney", "AU"], ["New York", "US"], ["Lagos", "NG"]];
const MUST_ASK = ["Springfield"]; // several real towns share this name: the app must ask, not guess

(async () => {
  console.log("\n1. Place search: does each name land in the right country?\n");
  const resolved = [];
  for (const [name, country] of PLACES) {
    const found = await attempt(`search "${name}"`, () => searchPlaces(name));
    if (!found) continue;
    const top = found.results[0];
    if (!top) show("FAIL", `"${name}": no results`);
    else if (top.countryCode === country) { show("PASS", `"${name}" → ${top.label}  (${top.latitude.toFixed(2)}, ${top.longitude.toFixed(2)})`); resolved.push(top); }
    else show("FAIL", `"${name}" → ${top.label} [${top.countryCode}] but expected ${country}`);
  }
  for (const name of MUST_ASK) {
    const found = await attempt(`search "${name}"`, () => searchPlaces(name));
    if (found) show(found.ambiguous ? "PASS" : "WARN", `"${name}" is ${found.ambiguous ? "flagged as ambiguous (the person will choose)" : "NOT flagged ambiguous"}: ${found.results.slice(0, 3).map((r) => r.label).join(" | ")}`);
  }

  console.log("\n2. Weather: Open-Meteo vs MET Norway for the same places (current temperature)\n");
  for (const place of resolved.slice(0, 6)) {
    const [a, b] = await Promise.all([
      attempt(`Open-Meteo ${place.name}`, () => openMeteo.fetchForecast(place.latitude, place.longitude)),
      attempt(`MET Norway ${place.name}`, () => metno.fetchForecast(place.latitude, place.longitude)),
    ]);
    if (!a || !b) continue;
    const problems = [...checkSanity(a).map((p) => `Open-Meteo ${p}`), ...checkSanity(b).map((p) => `MET Norway ${p}`)];
    const gap = Math.abs(a.current.temp - b.current.temp);
    const line = `${place.name}: Open-Meteo ${a.current.temp.toFixed(1)}°C · MET Norway ${b.current.temp.toFixed(1)}°C · gap ${gap.toFixed(1)}°`;
    if (problems.length) show("FAIL", `${line} · ${problems.join("; ")}`);
    else if (a.timezone !== b.timezone) show("WARN", `${line} · different timezones (${a.timezone} vs ${b.timezone})`);
    else show(gap > 10 ? "FAIL" : gap > 6 ? "WARN" : "PASS", line);
  }

  console.log("\n3. Extras\n");
  const delhi = resolved.find((p) => p.name === "Delhi") || resolved[0];
  if (delhi) {
    const air = await openMeteo.getAirQuality(delhi.latitude, delhi.longitude);
    show(air ? "PASS" : "WARN", air ? `Air quality for ${delhi.name}: US AQI ${air.aqi} (pollen ${air.pollen.available ? "available" : "not available here, as expected outside Europe"})` : "Air quality returned nothing");
    const climate = await attempt("10-year history", () => openMeteo.getClimate(delhi.latitude, delhi.longitude));
    if (climate) show(climate.dates.length > 3000 ? "PASS" : "WARN", `History: ${climate.dates.length} days (${climate.dates[0]} → ${climate.dates.at(-1)})`);
    const range = await attempt("16-day forecast", () => openMeteo.getDailyRange(delhi.latitude, delhi.longitude));
    if (range) show(range.length >= 14 ? "PASS" : "WARN", `Trip-planner forecast: ${range.length} days`);
  }
  const radar = await attempt("RainViewer", async () => {
    const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
  if (radar) show(radar.radar?.past?.length ? "PASS" : "WARN", `Radar frames: ${radar.radar?.past?.length ?? 0} past, ${radar.radar?.nowcast?.length ?? 0} forecast`);

  console.log(`\n${failures ? "✗" : "✓"} ${failures} failed, ${warnings} warnings\n`);
  process.exit(failures ? 1 : 0);
})();
