// Finding places. The old code took the FIRST search hit, which is how "Gujarat"
// could land in Nepal. Now we ask two sources, merge, rank by place type and
// population, flag real ambiguity, and the app sends exact coordinates afterwards.
const { getJson } = require("./http");
const { memo } = require("./cache");

const clean = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/* ---------------- the two sources ---------------- */

function fromOpenMeteo(r) {
  return {
    name: r.name, admin1: r.admin1 || "", country: r.country || "", countryCode: r.country_code || "",
    latitude: r.latitude, longitude: r.longitude, population: r.population || 0, featureCode: r.feature_code || "",
  };
}

async function searchOpenMeteo(query, language) {
  const data = await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=${language}&format=json`
  );
  return (data.results || []).map(fromOpenMeteo);
}

// Photon (OpenStreetMap data) is good at states and regions such as "Gujarat"
function fromPhoton(feature) {
  const p = feature.properties || {};
  const isPlace = p.osm_key === "place" || (p.osm_key === "boundary" && p.osm_value === "administrative");
  if (!isPlace || !p.name || !feature.geometry?.coordinates) return null;
  const kind = p.type === "state" || p.osm_value === "state" ? "ADM1"
    : p.type === "county" || p.osm_value === "county" ? "ADM2"
    : p.type === "country" ? "PCLI" : "PPL";
  return {
    name: p.name, admin1: kind === "ADM1" ? "" : p.state || "", country: p.country || "", countryCode: (p.countrycode || "").toUpperCase(),
    latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0], population: 0, featureCode: kind,
  };
}

async function searchPhoton(query) {
  const data = await getJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en`);
  return (data.features || []).map(fromPhoton).filter(Boolean);
}

// Optional: Geoapify (set GEOAPIFY_KEY in .env, free tier available) - better small-town coverage than the free sources
function fromGeoapify(feature) {
  const p = feature.properties || {};
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  const name = p.city || p.name || p.state || p.country;
  if (!name) return null;
  const kind = { country: "PCLI", state: "ADM1", county: "ADM2" }[p.result_type] || "PPL";
  return {
    name, admin1: kind === "ADM1" ? "" : p.state || "", country: p.country || "", countryCode: String(p.country_code || "").toUpperCase(),
    latitude: p.lat, longitude: p.lon, population: 0, featureCode: kind,
  };
}

async function searchGeoapify(query, language) {
  if (!process.env.GEOAPIFY_KEY) return [];
  const data = await getJson(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=8&lang=${language}&apiKey=${process.env.GEOAPIFY_KEY}`);
  return (data.features || []).map(fromGeoapify).filter(Boolean);
}

/* ---------------- ranking ---------------- */

const FEATURE_POINTS = { PPLC: 40, ADM1: 35, PPLA: 30, PPLA2: 20, PPLA3: 12, PPLA4: 8 };
const ADMIN_FEATURES = ["ADM1", "ADM2", "PCLI", "PPLC"];

function score(place, query) {
  const q = clean(query);
  const name = clean(place.name);
  let s = FEATURE_POINTS[place.featureCode] || 0;
  if (name === q) s += 60;
  else if (name.startsWith(q)) s += 25;
  if (clean(place.admin1) === q) s += 10;
  if (place.population > 0) s += Math.log10(place.population + 1) * 8;
  else if (!ADMIN_FEATURES.includes(place.featureCode)) s -= 15; // tiny unknown places lose to real cities and states
  return s;
}

// Same place reported by both sources? Keep only the better one.
function dedupe(sorted) {
  const kept = [];
  for (const place of sorted) {
    const twin = kept.find((k) => {
      const sameCountry = !k.countryCode || !place.countryCode || k.countryCode === place.countryCode;
      return sameCountry && distanceKm(k, place) < 40 && (clean(k.name) === clean(place.name));
    });
    if (!twin) kept.push(place);
  }
  return kept;
}

const labelOf = (p) => [p.name, p.admin1 && clean(p.admin1) !== clean(p.name) ? p.admin1 : "", p.country].filter(Boolean).join(", ");

// Pure function (easy to test): merge result lists and rank them.
function rankPlaces(lists, query, limit = 8) {
  const all = lists.flat().map((p) => ({ ...p, score: score(p, query) })).sort((a, b) => b.score - a.score);
  const results = dedupe(all).slice(0, limit).map((p) => ({ ...p, label: labelOf(p) }));

  // "Springfield" really is several towns of similar rank: let the person choose
  const [first, second] = results;
  const ambiguous = Boolean(first && second && clean(first.name) === clean(second.name) &&
    (first.countryCode !== second.countryCode || first.admin1 !== second.admin1) && first.score - second.score < 25);
  return { results, ambiguous };
}

async function searchPlaces(query, language = "en") {
  const text = String(query || "").trim();
  if (text.length < 2) return { results: [], ambiguous: false };

  return memo("geo", `${language}|${clean(text)}`, 10 * 60000, async () => {
    const [open, photon, geoapify] = await Promise.allSettled([searchOpenMeteo(text, language), searchPhoton(text), searchGeoapify(text, language)]);
    if (open.status === "rejected" && photon.status === "rejected" && geoapify.status === "rejected") throw new Error("Place search is unavailable");
    return rankPlaces([open.value || [], photon.value || [], geoapify.value || []], text);
  });
}

// Used for the default city and old history rows that have no coordinates
async function resolveCity(query, language = "en") {
  return (await searchPlaces(query, language)).results[0] || null;
}

// GPS coordinates -> a readable place name
async function reverseGeocode(latitude, longitude) {
  try {
    const data = await getJson(`https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}&lang=en`, 5000);
    const p = data.features?.[0]?.properties;
    const name = p && (p.city || p.name || p.district || p.county || p.state);
    if (name) return { name, admin1: p.state && p.state !== name ? p.state : "", country: p.country || "", countryCode: (p.countrycode || "").toUpperCase(), latitude, longitude };
  } catch (error) {
    console.warn("Reverse geocoding failed:", error.message);
  }
  return { name: "Current location", admin1: "", country: "", countryCode: "", latitude, longitude };
}

module.exports = { fromGeoapify, searchPlaces, resolveCity, reverseGeocode, rankPlaces, labelOf };
