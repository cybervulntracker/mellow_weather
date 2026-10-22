// Helpers for "local" ISO times such as "2026-10-12T14:15" (no timezone suffix),
// which is how Open-Meteo reports the time at the place you asked about.
const pad = (n) => String(n).padStart(2, "0");

// Treat the written clock fields as if they were UTC so we can do plain maths.
const toMs = (iso) => {
  const [d, t = "00:00"] = iso.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return Date.UTC(y, m - 1, day, h, min);
};

const fromMs = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

const addMinutes = (iso, minutes) => fromMs(toMs(iso) + minutes * 60000);
const minutesBetween = (fromIso, toIso) => Math.round((toMs(toIso) - toMs(fromIso)) / 60000);

// The wall-clock time in a given IANA timezone: { date: "2026-10-12", hour: 14, iso: "2026-10-12T14:15" }
function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    iso: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`,
  };
}

module.exports = { addMinutes, minutesBetween, localParts };
