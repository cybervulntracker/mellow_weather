// Sun and moon maths (no network). Sunrise/sunset follow the public-domain SunCalc method.
const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;

const toJulian = (date) => date.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = (j) => new Date((j + 0.5 - J1970) * DAY_MS);

// When does the sun cross `altitudeDeg` (rising and setting) on the day nearest `date`? Null near the poles.
function sunTimes(date, lat, lon, altitudeDeg = -0.833) {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = toJulian(date) - J2000;
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + (0 + lw) / (2 * Math.PI) + n;
  const M = RAD * (357.5291 + 0.98560028 * ds);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(RAD * 23.4397) * Math.sin(L));
  const noon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  const w = Math.acos((Math.sin(altitudeDeg * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  if (Number.isNaN(w)) return null; // polar day or night
  const a = 0.0009 + (w + lw) / (2 * Math.PI) + n;
  const set = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return { sunrise: fromJulian(noon - (set - noon)), sunset: fromJulian(set) };
}

const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a reference new moon

function moonPhase(date) {
  const age = ((((date.getTime() - KNOWN_NEW_MOON) / DAY_MS) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2;
  const edges = [
    [1.84, "newMoon"], [5.53, "waxingCrescent"], [9.22, "firstQuarter"], [12.91, "waxingGibbous"],
    [16.61, "fullMoon"], [20.3, "waningGibbous"], [23.99, "lastQuarter"], [27.68, "waningCrescent"],
  ];
  const phase = (edges.find(([limit]) => age < limit) || [0, "newMoon"])[1];
  return { phase, illumination: Math.round(illumination * 100), ageDays: Math.round(age * 10) / 10 };
}

// Golden hour = the sun between -4° and +6° above the horizon (photographers' definition).
// Returns the length of each window in minutes, measured from sunrise/sunset, so the caller can
// apply them to the provider's local sunrise/sunset times without any timezone maths.
function goldenHourOffsets(date, lat, lon) {
  const horizon = sunTimes(date, lat, lon, -0.833);
  const high = sunTimes(date, lat, lon, 6);
  const low = sunTimes(date, lat, lon, -4);
  if (!horizon || !high || !low) return null;
  const min = (a, b) => Math.round(Math.abs(a - b) / 60000);
  return {
    morningBeforeSunrise: min(horizon.sunrise, low.sunrise), // starts this long before sunrise
    morningAfterSunrise: min(horizon.sunrise, high.sunrise), // ends this long after sunrise
    eveningBeforeSunset: min(horizon.sunset, high.sunset), // starts this long before sunset
    eveningAfterSunset: min(horizon.sunset, low.sunset), // ends this long after sunset
  };
}

module.exports = { sunTimes, moonPhase, goldenHourOffsets };
