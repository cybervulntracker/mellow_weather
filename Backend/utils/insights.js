// Turns raw forecast numbers into plain-language advice. Everything returned is
// { key, params } so the browser can show it in the user's language.
const { isWetCode } = require("./conditions");

const SEVERITY = { watch: 1, warning: 2, severe: 3 };
const max = (list) => (list.length ? Math.max(...list) : 0);

const wetHour = (h) => (h.precipProb != null && h.precipProb >= 50) || h.precipMm >= 0.5 || isWetCode(h.code);

/* ---------------- alerts (generated from the forecast, not official warnings) ---------------- */

function buildAlerts(f, air) {
  const found = [];
  const add = (type, severity, date, value = null) => found.push({ type, severity, date, value });

  f.daily.slice(0, 3).forEach((d, i) => {
    if (d.max >= 45) add("heat", "severe", d.date, Math.round(d.max));
    else if (d.max >= 40) add("heat", "warning", d.date, Math.round(d.max));
    else if (d.max >= 38) add("heat", "watch", d.date, Math.round(d.max));

    if (d.min <= -10) add("cold", "warning", d.date, Math.round(d.min));
    else if (d.min <= 0) add("cold", "watch", d.date, Math.round(d.min));

    // rainfall thresholds follow the India Met Department's "heavy" and "very heavy" bands
    if (d.precipSum >= 115.6) add("rain", "severe", d.date, Math.round(d.precipSum));
    else if (d.precipSum >= 64.5) add("rain", "warning", d.date, Math.round(d.precipSum));
    else if (d.precipSum >= 30) add("rain", "watch", d.date, Math.round(d.precipSum));

    const gust = d.gustMax ?? d.windMax ?? 0;
    if (gust >= 75) add("wind", "warning", d.date, Math.round(gust));
    else if (gust >= 50) add("wind", "watch", d.date, Math.round(gust));

    if (d.code >= 95) add("storm", "warning", d.date);
    if (i === 0 && d.uvMax != null) {
      if (d.uvMax >= 11) add("uv", "warning", d.date, Math.round(d.uvMax));
      else if (d.uvMax >= 8) add("uv", "watch", d.date, Math.round(d.uvMax));
    }
  });

  if (air) {
    if (air.aqi >= 300) add("air", "severe", f.daily[0].date, air.aqi);
    else if (air.aqi >= 200) add("air", "warning", f.daily[0].date, air.aqi);
    else if (air.aqi >= 150) add("air", "watch", f.daily[0].date, air.aqi);
  }
  const visibility = f.hourly[0]?.visibilityM;
  if (visibility != null && visibility < 1000) add("fog", "watch", f.daily[0].date, Math.round(visibility));

  // one alert per type: the most severe, then the earliest
  const strongest = new Map();
  for (const a of found) {
    const old = strongest.get(a.type);
    if (!old || SEVERITY[a.severity] > SEVERITY[old.severity]) strongest.set(a.type, a);
  }
  return [...strongest.values()].sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity]);
}

/* ---------------- smart summary ---------------- */

function buildSummary(f, air) {
  const c = f.current;
  const next12 = f.hourly.slice(0, 12);
  const sentences = [];
  const tips = [];

  if (isWetCode(c.code)) {
    const dry = next12.find((h) => !wetHour(h));
    sentences.push(dry ? { key: "rainNowEndsAt", params: { time: dry.time } } : { key: "rainNowAllDay", params: {} });
    tips.push("umbrella");
  } else {
    const wet = next12.find(wetHour);
    sentences.push(wet ? { key: "rainAt", params: { time: wet.time } } : { key: "dryAhead", params: {} });
    if (wet) tips.push("umbrella");
  }

  sentences.push({ key: "highToday", params: { high: Math.round(f.daily[0].max) } });

  const uvSoon = max(next12.map((h) => h.uv ?? 0));
  if (c.isDay && uvSoon >= 6) tips.push("sunscreen");
  if (air && air.aqi >= 150) tips.push("mask");
  if (f.daily[0].max >= 38) tips.push("hydrate");
  if (c.temp <= 10) tips.push("jacket");

  return { sentences, tips };
}

/* ---------------- why it feels different ---------------- */

function explainFeelsLike(c) {
  const diff = Math.round(c.feels - c.temp);
  if (Math.abs(diff) < 2) return { diff, reasons: [{ key: "similar", params: {} }] };

  const reasons = [];
  if (diff > 0) {
    if (c.humidity >= 60) reasons.push({ key: "humid", params: { value: Math.round(c.humidity) } });
    if (c.windKmh < 8) reasons.push({ key: "calmAir", params: {} });
    if (!reasons.length) reasons.push({ key: "sunWarm", params: {} });
  } else {
    if (c.windKmh >= 12) reasons.push({ key: "windChill", params: { windKmh: Math.round(c.windKmh) } });
    if (c.humidity >= 80 && c.temp < 15) reasons.push({ key: "damp", params: {} });
    if (!reasons.length) reasons.push({ key: "coolAir", params: {} });
  }
  return { diff, reasons };
}

/* ---------------- "good day for ...?" ---------------- */

function buildRecommendations(f, air, alerts) {
  const c = f.current;
  const next12 = f.hourly.slice(0, 12);
  const rainProb = max(next12.map((h) => h.precipProb ?? 0));
  const wet = isWetCode(c.code) || next12.some(wetHour);
  const aqi = air?.aqi ?? 0;
  const visibilities = next12.map((h) => h.visibilityM).filter((v) => v != null);
  const minVisibility = visibilities.length ? Math.min(...visibilities) : null;
  const severeWeather = alerts.some((a) => ["storm", "rain", "wind", "fog"].includes(a.type) && a.severity !== "watch");

  const verdict = (poor, fair, good) => ({
    rating: poor.length ? "poor" : fair.length ? "fair" : "good",
    reasons: poor.length ? poor : fair.length ? fair : [good],
  });

  const running = (() => {
    const poor = [], fair = [];
    if (aqi > 150) poor.push("airBad"); else if (aqi > 100) fair.push("airModerate");
    if (rainProb >= 60 || isWetCode(c.code)) poor.push("rainy"); else if (rainProb >= 30) fair.push("mightRain");
    if (c.feels > 36) poor.push("tooHot"); else if (c.feels > 30) fair.push("warm");
    if (c.feels < 0) poor.push("tooCold");
    if (c.code >= 95) poor.push("stormy");
    if (c.windKmh > 30) fair.push("windy");
    return verdict(poor, fair, "comfortable");
  })();

  const laundry = (() => {
    const poor = [], fair = [];
    if (rainProb >= 50 || wet) poor.push("rainy"); else if (rainProb >= 30) fair.push("mightRain");
    if (c.humidity >= 85) poor.push("veryHumid"); else if (c.humidity >= 70) fair.push("humid");
    if (c.clouds >= 80) fair.push("cloudy");
    return verdict(poor, fair, "goodDrying");
  })();

  const travel = (() => {
    const poor = [], fair = [];
    if (severeWeather) poor.push("severeWeather");
    if (minVisibility != null && minVisibility < 1000) poor.push("lowVisibility"); else if (minVisibility != null && minVisibility < 5000) fair.push("reducedVisibility");
    if (c.windKmh > 60) poor.push("strongWind");
    if (rainProb >= 50) fair.push("rainy");
    if (aqi >= 200) fair.push("smoggy");
    return verdict(poor, fair, "clearRoads");
  })();

  const outdoors = (() => {
    const poor = [], fair = [];
    if (rainProb >= 60 || isWetCode(c.code)) poor.push("rainy"); else if (rainProb >= 30) fair.push("mightRain");
    if (c.feels > 38 || c.feels < 5) poor.push(c.feels > 38 ? "tooHot" : "tooCold");
    else if (c.feels > 33) fair.push("warm"); else if (c.feels < 15) fair.push("cool");
    if (c.windKmh > 30) fair.push("windy");
    if (aqi > 150) poor.push("airBad"); else if (aqi > 100) fair.push("airModerate");
    return verdict(poor, fair, "pleasant");
  })();

  return [
    { activity: "running", ...running },
    { activity: "laundry", ...laundry },
    { activity: "travel", ...travel },
    { activity: "outdoors", ...outdoors },
  ];
}

/* ---------------- nowcast from 15-minute rain amounts ---------------- */

function buildNowcast(slots, stepMin = 15) {
  if (!slots?.length) return null;
  const wet = (s) => s.mm >= 0.1;
  const first = slots.findIndex(wet);
  const peak = max(slots.map((s) => s.mm));
  const intensity = peak >= 2.5 ? "heavy" : peak >= 0.5 ? "moderate" : "light";

  if (first === -1) return { status: "dry", minutes: null, intensity: null, stepMin, slots };
  if (first === 0) {
    const end = slots.findIndex((s) => !wet(s));
    return { status: "raining", minutes: end === -1 ? null : end * stepMin, intensity, stepMin, slots };
  }
  return { status: "rainSoon", minutes: first * stepMin, intensity, stepMin, slots };
}

module.exports = { buildAlerts, buildSummary, explainFeelsLike, buildRecommendations, buildNowcast };
