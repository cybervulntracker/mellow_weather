// Checks the translations: every key used in the code exists in English and Hindi,
// both dictionaries have exactly the same keys, and no key is left unused.
// Run: npm run check:i18n
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(jsx?|mjs)$/.test(name) && !path.includes("/i18n/")) files.push(path);
  }
})(SRC);

// Families of keys built at run time, with every value the server or code can produce.
const FAMILIES = {
  "ago.": ["now", "min", "hr", "day"],
  "cond.": ["clear", "clearNight", "mostlyClear", "mostlyClearNight", "partlyCloudy", "overcast", "fog", "drizzle", "lightRain", "rain", "heavyRain", "freezingRain", "snow", "rainShowers", "thunderstorm", "cloudy"],
  "alert.title.": ["heat", "cold", "rain", "wind", "storm", "uv", "air", "fog"],
  "alert.detail.": ["heat", "cold", "rain", "wind", "storm", "uv", "air", "fog"],
  "alert.severity.": ["watch", "warning", "severe"],
  "insight.": ["rainNowEndsAt", "rainNowAllDay", "rainAt", "dryAhead", "highToday"],
  "tip.": ["umbrella", "sunscreen", "mask", "hydrate", "jacket", "light", "warm"],
  "feels.": ["similar", "humid", "calmAir", "sunWarm", "windChill", "damp", "coolAir"],
  "activity.": ["running", "laundry", "travel", "outdoors"],
  "rating.": ["good", "fair", "poor"],
  "reason.": ["comfortable", "airBad", "airModerate", "rainy", "mightRain", "tooHot", "warm", "tooCold", "stormy", "windy", "goodDrying", "veryHumid", "humid", "cloudy", "severeWeather", "lowVisibility", "reducedVisibility", "strongWind", "smoggy", "clearRoads", "pleasant", "cool"],
  "aqi.": ["good", "moderate", "sensitive", "unhealthy", "veryUnhealthy", "hazardous"],
  "aqi.advice.": ["good", "moderate", "sensitive", "unhealthy", "veryUnhealthy", "hazardous"],
  "pollen.": ["alder", "birch", "grass", "mugwort", "olive", "ragweed"],
  "pollen.level.": ["low", "moderate", "high", "veryHigh"],
  "moon.": ["newMoon", "waxingCrescent", "firstQuarter", "waxingGibbous", "fullMoon", "waningGibbous", "lastQuarter", "waningCrescent"],
  "nowcast.intensity.": ["light", "moderate", "heavy"],
  "desc.humidity.": ["dry", "comfortable", "humid", "veryHumid"],
  "desc.wind.": ["calm", "lightBreeze", "breezy", "windy", "strong"],
  "desc.visibility.": ["clear", "moderate", "hazy", "poor"],
  "desc.uv.": ["low", "moderate", "high", "veryHigh", "extreme"],
  "desc.pressure.": ["low", "normal", "high"],
  "desc.rain.": ["unlikely", "possible", "likely"],
  "greet.": ["night", "morning", "afternoon", "evening"],
  "theme.": ["system", "light", "dark"],
  "auth.strength.": ["0", "1", "2", "3", "4"],
  "forecast.tab.": ["forecast", "trends", "radar"],
  "settings.tab.": ["preferences", "notifications", "security", "help"],
  "explore.": ["temp", "feels", "rain", "rainMm", "humidity", "wind", "pressure", "uv", "clouds"],
  "metric.trend.": ["rising", "falling", "steady"],
  "pollenIdx.": ["tree", "grass", "weed"],
  "auth.chip.": ["radar", "radar.sub", "alerts", "alerts.sub", "rain", "rain.sub", "air", "air.sub", "sun", "sun.sub", "trends", "trends.sub"],
  "support.cat.": ["bug", "idea", "account", "other"],
  "support.status.": ["open", "answered", "closed"],
  "hist.group.": ["today", "yesterday", "week", "earlier"],
  "hist.sort.": ["recent", "most", "az"],
  "me.badge.": ["explorer", "explorer.how", "collector", "collector.how", "globe", "globe.how", "regular", "regular.how", "veteran", "veteran.how", "nightowl", "nightowl.how"],
  "rules.metric.": ["tempMax", "tempMin", "rainProb", "windMax", "uvMax", "aqi"],
  "trip.": ["forecast", "typical"],
  "climate.": ["warmer", "cooler"],
  "when.": ["today", "tomorrow"],
  "notif.": ["digestTitle", "rainTomorrowTitle", "ruleTitle", "supportReplyTitle"],
  "notif.line.": ["rainTomorrowLine", "rule_tempMax", "rule_tempMin", "rule_rainProb", "rule_windMax", "rule_uvMax", "rule_aqi", "supportReplyLine"],
};

const used = new Set();
const dynamicSeen = new Set();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/\bt\(\s*`([\w.]+\.)\$\{/g)) dynamicSeen.add(m[1]);
  for (const m of text.matchAll(/\b(?:label|key)\??:\s*"((?:compare\.row|rules\.metric|settings\.tab)\.[\w.]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/\["((?:compare\.row)\.[\w]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/key:\s*"(nav\.[\w]+)"/g)) used.add(m[1]);
}
for (const prefix of dynamicSeen) {
  if (!FAMILIES[prefix]) { console.error(`✗ dynamic key family "${prefix}\${…}" is used in the code but not listed in check-i18n.mjs`); process.exitCode = 1; }
}
for (const [prefix, values] of Object.entries(FAMILIES)) for (const v of values) used.add(prefix + v);

const load = async (name) => (await import(pathToFileURL(join(SRC, "i18n", name)).href)).default;
const en = await load("en.js");
const hi = await load("hi.js");

let problems = 0;
const report = (label, list) => { if (list.length) { problems += list.length; console.error(`✗ ${label} (${list.length}):\n   ${list.join("\n   ")}`); } };
report("keys used in code but missing from English", [...used].filter((k) => !(k in en)).sort());
report("keys in English but missing from Hindi", Object.keys(en).filter((k) => !(k in hi)));
report("keys in Hindi but not in English", Object.keys(hi).filter((k) => !(k in en)));
report("keys defined but never used", Object.keys(en).filter((k) => !used.has(k)).sort());
report("Hindi texts with different {placeholders} than English", Object.keys(en).filter((k) => k in hi && [...en[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join() !== [...hi[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()));
report("empty texts", Object.entries({ ...en, ...hi }).filter(([, v]) => !String(v).trim()).map(([k]) => k));

console.log(`checked ${files.length} files · ${used.size} keys used · ${Object.keys(en).length} English · ${Object.keys(hi).length} Hindi`);
process.exit(problems ? 1 : 0);
