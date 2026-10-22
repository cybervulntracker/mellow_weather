// Small formatting helpers shared by the weather site and the admin panel.

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m ${s % 60 ? `${s % 60}s` : ""}`.trim();
  return `${h}h ${m}m`;
}

export function formatNumber(n) {
  return new Intl.NumberFormat("en-IN").format(Number(n) || 0);
}

export function formatDateTime(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDate(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatShortDay(isoDay) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// "5 min ago". Pass the translate function `t` to get the person's language (English otherwise).
export function timeAgo(date, t) {
  if (!date) return t ? t("ago.never") : "Never";
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  const say = (key, n, english) => (t ? t(key, { n }) : english);
  if (seconds < 45) return say("ago.now", 0, "Just now");
  if (seconds < 3600) { const n = Math.max(1, Math.round(seconds / 60)); return say("ago.min", n, `${n} min ago`); }
  if (seconds < 86400) { const n = Math.round(seconds / 3600); return say("ago.hr", n, `${n} hr ago`); }
  if (seconds < 86400 * 7) { const n = Math.round(seconds / 86400); return say("ago.day", n, `${n} d ago`); }
  return formatDate(date);
}

// which greeting to use at this hour (the words come from the translations)
export function greetingKey(date = new Date()) {
  const h = date.getHours();
  return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
