import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { LineChart } from "../ui/Viz";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { toPrecip, toPressure, toTemp, toWind } from "../../lib/units";

// An interactive chart of the next 12 / 24 / 48 hours: pick what to look at, then hover or touch the chart.
export default function HourlyExplorer({ defaultMetric = "temp" }) {
  const { weather } = useWeather();
  const { t, fmt, unit, windUnit, pressureUnit, precipUnit } = usePrefs();
  const [metric, setMetric] = useState(defaultMetric);
  const [hours, setHours] = useState(24);
  const [compare, setCompare] = useState(false);

  const METRICS = useMemo(() => ({
    temp: { color: "#f59e0b", get: (h) => toTemp(h.temp, unit), fmt: (v) => `${v}°` },
    feels: { color: "#ec4899", get: (h) => toTemp(h.feels, unit), fmt: (v) => `${v}°` },
    rain: { color: "#6366f1", get: (h) => h.precip, fmt: (v) => `${v}%`, min: 0, max: 100 },
    rainMm: { color: "#06b6d4", get: (h) => toPrecip(h.rainMm, precipUnit), fmt: (v) => `${v} ${precipUnit}`, min: 0 },
    humidity: { color: "#10b981", get: (h) => h.humidity, fmt: (v) => `${v}%`, min: 0, max: 100 },
    wind: { color: "#0ea5e9", get: (h) => toWind(h.wind, windUnit), fmt: (v) => `${v}`, min: 0 },
    pressure: { color: "#8b5cf6", get: (h) => (h.pressure == null ? null : Number(toPressure(h.pressure, pressureUnit))), fmt: (v) => `${v}` },
    uv: { color: "#f97316", get: (h) => h.uv, fmt: (v) => `${v}`, min: 0 },
    clouds: { color: "#64748b", get: (h) => h.clouds, fmt: (v) => `${v}%`, min: 0, max: 100 },
  }), [unit, windUnit, pressureUnit, precipUnit]);

  const rows = weather.hourly.slice(0, hours);
  const available = Object.keys(METRICS).filter((k) => rows.some((h) => METRICS[k].get(h) != null));
  const current = METRICS[available.includes(metric) ? metric : "temp"];
  const key = available.includes(metric) ? metric : "temp";
  const labels = rows.map((h, i) => (i === 0 ? t("hourly.now") : fmt.hour(h.time)));
  const values = rows.map((h) => current.get(h));
  const nums = values.filter((v) => v != null);
  const series = [{ key, label: t(`explore.${key}`), color: current.color, values }];
  if (compare && key === "temp") series.push({ key: "feels", label: t("explore.feels"), color: METRICS.feels.color, values: rows.map((h) => METRICS.feels.get(h)), dashed: true });

  const peakIndex = values.indexOf(Math.max(...nums));
  const lowIndex = values.indexOf(Math.min(...nums));
  const avg = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

  return (
    <section className="card explorer">
      <div className="card__head">
        <h2 className="card__title"><Activity size={16} /> {t("explore.title")}</h2>
        <div className="segmented segmented--sm" role="group" aria-label={t("explore.range")}>
          {[12, 24, 48].map((n) => <button key={n} className={`segmented__btn ${hours === n ? "is-active" : ""}`} onClick={() => setHours(n)}>{n}h</button>)}
        </div>
      </div>

      <div className="explorer__tabs" role="tablist">
        {available.map((k) => (
          <button key={k} role="tab" aria-selected={k === key} className={`explorer__tab ${k === key ? "is-active" : ""}`} style={{ "--c": METRICS[k].color }} onClick={() => setMetric(k)}>
            {t(`explore.${k}`)}
          </button>
        ))}
      </div>

      <LineChart labels={labels} series={series} format={current.fmt} yMin={current.min} yMax={current.max} height={270} every={hours <= 12 ? 1 : hours <= 24 ? 3 : 6} ariaLabel={t("explore.title")} />

      <div className="explorer__stats">
        <div><span>{t("explore.peak")}</span><strong>{nums.length ? current.fmt(values[peakIndex]) : "—"}</strong><small>{rows[peakIndex] && fmt.hour(rows[peakIndex].time)}</small></div>
        <div><span>{t("explore.low")}</span><strong>{nums.length ? current.fmt(values[lowIndex]) : "—"}</strong><small>{rows[lowIndex] && fmt.hour(rows[lowIndex].time)}</small></div>
        <div><span>{t("explore.avg")}</span><strong>{avg == null ? "—" : current.fmt(avg)}</strong><small>{t("explore.hours", { n: hours })}</small></div>
        {key === "temp" && (
          <label className="explorer__toggle"><input type="checkbox" className="switch" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> {t("explore.compareFeels")}</label>
        )}
      </div>
    </section>
  );
}
