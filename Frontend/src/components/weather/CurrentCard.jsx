import { ArrowDown, ArrowUp, Droplets, Home, MapPin, Star, Sun, Wind } from "lucide-react";
import WeatherIcon from "../ui/WeatherIcon";
import WeatherScene from "../ui/WeatherScene";
import Counter from "../ui/Counter";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { toTemp } from "../../lib/units";

export default function CurrentCard() {
  const { weather, toggleFavorite } = useWeather();
  const { t, fmt, unit } = usePrefs();
  const saved = Boolean(weather.favoriteId);
  const region = [weather.admin1, weather.country].filter(Boolean).join(", ");
  const temp = toTemp(weather.temperature, unit);

  return (
    <section className={`current current--${weather.condition}`}>
      <WeatherScene kind={weather.condition} />
      <div className="current__top">
        <div>
          <p className="current__place">
            <MapPin size={16} /> {weather.city}<span>{region && `, ${region}`}</span>
            {weather.isHome && <em className="current__home"><Home size={12} /> {t("fav.home")}</em>}
          </p>
          <p className="current__time">{fmt.placeTime(weather.localTime)}</p>
        </div>
        <button className={`pill-btn ${saved ? "is-saved" : ""}`} onClick={toggleFavorite} aria-pressed={saved}>
          <Star size={16} fill={saved ? "currentColor" : "none"} /> {saved ? t("home.saved") : t("home.save")}
        </button>
      </div>

      <div className="current__main">
        <div>
          <div className="current__temp"><Counter value={temp} /><span>°{unit}</span></div>
          <p className="current__label">{t(`cond.${weather.conditionKey}`)}</p>
          <p className="current__meta">
            {t("home.feelsLike", { temp: fmt.temp(weather.feelsLike) })}
            <span className="dot" />
            <ArrowUp size={14} /> {fmt.temp(weather.high)}
            <ArrowDown size={14} /> {fmt.temp(weather.low)}
          </p>
        </div>
        <WeatherIcon name={weather.icon} isDay={weather.isDay} size={118} strokeWidth={1.1} className="current__icon" />
      </div>

      <div className="chips-row">
        <span className="glass-chip"><Droplets size={14} /> {weather.humidity}%</span>
        <span className="glass-chip"><Wind size={14} /> {fmt.wind(weather.wind)}</span>
        {weather.uvIndex != null && <span className="glass-chip"><Sun size={14} /> UV {weather.uvIndex}</span>}
        {weather.air && <span className="glass-chip"><i className={`aqi-dot aqi--${weather.air.category}`} /> AQI {weather.air.aqi}</span>}
        {weather.precipitation != null && <span className="glass-chip">☔ {weather.precipitation}%</span>}
      </div>
    </section>
  );
}
