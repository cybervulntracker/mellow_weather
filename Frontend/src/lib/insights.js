// Turns the server's { key, params } lines (alerts, summary, notifications) into text in the user's language.

const RULE_KIND = { tempMax: "temp", tempMin: "temp", windMax: "wind", rainProb: "percent", uvMax: "plain", aqi: "plain" };

function formatRuleNumber(fmt, metric, value) {
  const kind = RULE_KIND[metric];
  return kind === "temp" ? fmt.temp(value) : kind === "wind" ? fmt.wind(value) : kind === "percent" ? `${value}%` : String(value);
}

// "when" for an alert: Today / Tomorrow / weekday name
export function whenText(t, fmt, weather, date) {
  if (date === weather.daily[0].date) return t("when.today");
  if (date === weather.daily[1]?.date) return t("when.tomorrow");
  return fmt.weekday(date);
}

export function alertValue(fmt, type, value) {
  if (value == null) return "";
  if (type === "heat" || type === "cold") return fmt.temp(value);
  if (type === "wind") return fmt.wind(value);
  if (type === "rain") return `${value} mm`;
  if (type === "fog") return `${value} m`;
  return String(value);
}

// One summary / notification line
export function lineText(t, fmt, line) {
  const p = line.params || {};
  if (line.key === "tips") return p.list.map((k) => t(`tip.${k}`)).join(" · ");
  if (line.key === "rainTomorrowLine") return t("notif.line.rainTomorrowLine", p);
  if (line.key.startsWith("rule_")) {
    const metric = line.key.slice(5);
    return t(`notif.line.${line.key}`, { value: formatRuleNumber(fmt, metric, p.value), threshold: formatRuleNumber(fmt, metric, p.threshold) });
  }
  return t(`insight.${line.key}`, { time: p.time ? fmt.hour(p.time) : "", high: p.high != null ? fmt.temp(p.high) : "" });
}

export function titleText(t, title) {
  return t(`notif.${title.key}`, title.params || {});
}

// the rule value a person typed (in their units) -> what we store (°C, km/h)
export { formatRuleNumber };
