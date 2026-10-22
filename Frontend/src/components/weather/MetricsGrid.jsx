import { ArrowDown, ArrowRight, ArrowUp, CloudRain, Droplets, Eye, Gauge as GaugeIcon, Sunrise, Sunset, Wind } from "lucide-react";
import { Gauge, Ring, WindCompass } from "../ui/Viz";
import Counter from "../ui/Counter";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { minutesBetween, toWind, WIND_UNITS } from "../../lib/units";
import { compass, humidityLevel, pressureLevel, rainLevel, uvLevel, visibilityLevel, windLevel } from "./describe";

const UV_STOPS = [[2, "#22c55e"], [5, "#eab308"], [7, "#f97316"], [10, "#ef4444"], [20, "#a855f7"]];

export default function MetricsGrid() {
  const { weather: w } = useWeather();
  const { t, fmt, windUnit } = usePrefs();
  const known = (v) => v != null;
  const daylight = w.astro.dayLengthMin != null ? { h: Math.floor(w.astro.dayLengthMin / 60), m: w.astro.dayLengthMin % 60 } : null;
  const untilSunset = w.sunset ? minutesBetween(w.localTime, w.sunset) : null;
  const trend = w.pressureTrend;
  const TrendIcon = trend?.direction === "rising" ? ArrowUp : trend?.direction === "falling" ? ArrowDown : ArrowRight;
  const gust = w.daily[0]?.gust;

  return (
    <section>
      <h2 className="section-title">{t("metric.title")}</h2>
      <div className="metrics metrics--rich">
        <div className="metric metric--viz">
          <div className="metric__head"><Wind size={16} /><span>{t("metric.wind")}</span></div>
          <WindCompass deg={w.windDirection ?? 0} speed={toWind(w.wind, windUnit)} unit={WIND_UNITS[windUnit]} />
          <span className="metric__sub">{t(`desc.wind.${windLevel(w.wind)}`)} · {compass(w.windDirection)}{known(gust) && ` · ${t("metric.gust")} ${fmt.wind(gust)}`}</span>
        </div>

        <div className="metric metric--viz">
          <div className="metric__head"><Droplets size={16} /><span>{t("metric.humidity")}</span></div>
          <Ring value={w.humidity} color="#10b981" size={104} stroke={11}><span><Counter value={w.humidity} />%</span></Ring>
          <span className="metric__sub">{t(`desc.humidity.${humidityLevel(w.humidity)}`)}</span>
        </div>

        <div className="metric metric--viz">
          <div className="metric__head"><SunIcon /><span>{t("metric.uv")}</span></div>
          {known(w.uvIndex) ? <Gauge value={w.uvIndex} min={0} max={11} stops={UV_STOPS} size={150} display={w.uvIndex} /> : <strong className="metric__value">—</strong>}
          <span className="metric__sub">{known(w.uvIndex) ? t(`desc.uv.${uvLevel(w.uvIndex)}`) : ""}</span>
        </div>

        <div className="metric metric--viz">
          <div className="metric__head"><CloudRain size={16} /><span>{t("metric.rain")}</span></div>
          <Ring value={w.precipitation ?? 0} color="#6366f1" size={104} stroke={11}><span>{known(w.precipitation) ? <><Counter value={w.precipitation} />%</> : "—"}</span></Ring>
          <span className="metric__sub">{known(w.precipitation) ? t(`desc.rain.${rainLevel(w.precipitation)}`) : ""}</span>
        </div>

        <div className="metric">
          <div className="metric__head"><Eye size={16} /><span>{t("metric.visibility")}</span></div>
          <strong className="metric__value">{known(w.visibility) ? fmt.distance(w.visibility) : "—"}</strong>
          {known(w.visibility) && <div className="bar"><i style={{ width: `${Math.min(100, (w.visibility / 20) * 100)}%` }} /></div>}
          <span className="metric__sub">{known(w.visibility) ? t(`desc.visibility.${visibilityLevel(w.visibility)}`) : ""}</span>
        </div>

        <div className="metric">
          <div className="metric__head"><GaugeIcon size={16} /><span>{t("metric.pressure")}</span></div>
          <strong className="metric__value">{fmt.pressure(w.pressure)}</strong>
          <span className="metric__sub">{t(`desc.pressure.${pressureLevel(w.pressure)}`)}</span>
          {trend && <span className={`trend trend--${trend.direction}`}><TrendIcon size={13} /> {t(`metric.trend.${trend.direction}`)}</span>}
        </div>

        <div className="metric">
          <div className="metric__head"><Sunrise size={16} /><span>{t("metric.sunrise")}</span></div>
          <strong className="metric__value">{fmt.clock(w.sunrise)}</strong>
          <span className="metric__sub">{daylight ? t("metric.daylight", daylight) : ""}</span>
        </div>

        <div className="metric">
          <div className="metric__head"><Sunset size={16} /><span>{t("metric.sunset")}</span></div>
          <strong className="metric__value">{fmt.clock(w.sunset)}</strong>
          <span className="metric__sub">{untilSunset == null ? "" : untilSunset <= 0 ? t("metric.sunHasSet") : t("metric.sunsetIn", { h: Math.floor(untilSunset / 60), m: untilSunset % 60 })}</span>
        </div>
      </div>
    </section>
  );
}

function SunIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
