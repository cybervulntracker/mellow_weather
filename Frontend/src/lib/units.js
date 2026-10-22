// Unit conversion and time formatting. Pure functions, no React.

export const toTemp = (celsius, unit) => (celsius == null ? null : unit === "F" ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius));
// a temperature DIFFERENCE (no +32 offset)
export const toTempDelta = (celsiusDiff, unit) => Math.round((unit === "F" ? (celsiusDiff * 9) / 5 : celsiusDiff) * 10) / 10;
export const toCelsius = (value, unit) => (unit === "F" ? Math.round((((value - 32) * 5) / 9) * 10) / 10 : value);

export const WIND_UNITS = { kmh: "km/h", mph: "mph", ms: "m/s" };
export const toWind = (kmh, unit) => (unit === "mph" ? Math.round(kmh * 0.621371) : unit === "ms" ? Math.round((kmh / 3.6) * 10) / 10 : Math.round(kmh));
export const toKmh = (value, unit) => (unit === "mph" ? value / 0.621371 : unit === "ms" ? value * 3.6 : value);

export const PRESSURE_UNITS = { hpa: "hPa", inhg: "inHg" };
export const toPressure = (hpa, unit) => (unit === "inhg" ? (hpa * 0.02953).toFixed(2) : Math.round(hpa));

export const PRECIP_UNITS = { mm: "mm", in: "in" };
export const toPrecip = (mm, unit) => (mm == null ? null : unit === "in" ? Math.round((mm / 25.4) * 100) / 100 : Math.round(mm * 10) / 10);
export const DISTANCE_UNITS = { km: "km", mi: "mi" };
export const toDistance = (km, unit) => (km == null ? null : unit === "mi" ? Math.round(km * 0.621371 * 10) / 10 : Math.round(km * 10) / 10);

// "2026-10-12T14:15" -> "2:15 PM" or "14:15"
export function clockText(iso, mode) {
  const hour = Number(iso.slice(11, 13));
  const minutes = iso.slice(14, 16);
  if (mode === "24h") return `${String(hour).padStart(2, "0")}:${minutes}`;
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

// "2026-10-12T14:00" -> "2 PM" or "14:00"
export function hourText(iso, mode) {
  const hour = Number(iso.slice(11, 13));
  return mode === "24h" ? `${String(hour).padStart(2, "0")}:00` : `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`;
}

const dateOf = (dateStr) => {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const weekdayText = (dateStr, locale) => dateOf(dateStr).toLocaleDateString(locale, { weekday: "long" });
export const dayText = (dateStr, locale) => dateOf(dateStr).toLocaleDateString(locale, { day: "numeric", month: "short" });

// "Sat, 12 Oct · 2:15 PM" for the time at the place being shown
export const placeTimeText = (iso, mode, locale) =>
  `${dateOf(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · ${clockText(iso, mode)}`;


// minutes from one local ISO time to another ("2026-10-12T14:15" -> "2026-10-12T17:57" = 222)
export function minutesBetween(fromIso, toIso) {
  const ms = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), Number(iso.slice(11, 13)), Number(iso.slice(14, 16)));
  return Math.round((ms(toIso) - ms(fromIso)) / 60000);
}
