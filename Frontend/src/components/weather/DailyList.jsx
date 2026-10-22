import { Droplet } from "lucide-react";
import WeatherIcon from "../ui/WeatherIcon";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { toTemp } from "../../lib/units";

export default function DailyList() {
  const { weather } = useWeather();
  const { t, fmt, unit } = usePrefs();
  const min = Math.min(...weather.daily.map((d) => d.low));
  const max = Math.max(...weather.daily.map((d) => d.high));
  const span = Math.max(max - min, 1);

  return (
    <section>
      <h2 className="section-title">{t("daily.title")}</h2>
      <div className="card daily">
        {weather.daily.map((d, i) => (
          <div className={`day ${i === 0 ? "is-today" : ""}`} key={d.date}>
            <span className="day__name">{i === 0 ? t("daily.today") : i === 1 ? t("daily.tomorrow") : fmt.weekday(d.date)}</span>
            <WeatherIcon name={d.icon} size={24} />
            <span className="day__cond">{t(`cond.${d.conditionKey}`)}</span>
            <span className="day__rain"><Droplet size={12} /> {d.precip}%</span>
            <div className="day__range">
              <span className="day__low">{toTemp(d.low, unit)}°</span>
              <div className="range">
                <div className="range__fill" style={{ left: `${((d.low - min) / span) * 100}%`, right: `${100 - ((d.high - min) / span) * 100}%` }} />
              </div>
              <span className="day__high">{toTemp(d.high, unit)}°</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
