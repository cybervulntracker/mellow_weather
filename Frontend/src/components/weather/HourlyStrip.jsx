import { Droplet } from "lucide-react";
import WeatherIcon from "../ui/WeatherIcon";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";

export default function HourlyStrip({ hours = 24 }) {
  const { weather } = useWeather();
  const { t, fmt } = usePrefs();
  return (
    <section>
      <h2 className="section-title">{t("hourly.title", { n: hours })}</h2>
      <div className="hourly">
        {weather.hourly.slice(0, hours).map((h, i) => (
          <div className={`hour ${i === 0 ? "is-now" : ""}`} key={h.time}>
            <span className="hour__time">{i === 0 ? t("hourly.now") : fmt.hour(h.time)}</span>
            <WeatherIcon name={h.icon} isDay={h.isDay} size={26} />
            <strong className="hour__temp">{fmt.temp(h.temp)}</strong>
            <span className="hour__rain"><Droplet size={11} /> {h.precip}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
