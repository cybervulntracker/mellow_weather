import { CloudFog, CloudLightning, CloudRainWind, Factory, Info, Snowflake, Sun, ThermometerSun, Wind } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { alertValue, whenText } from "../../lib/insights";

const ICONS = { heat: ThermometerSun, cold: Snowflake, rain: CloudRainWind, wind: Wind, storm: CloudLightning, uv: Sun, air: Factory, fog: CloudFog };

export default function AlertsBanner() {
  const { weather } = useWeather();
  const { t, fmt } = usePrefs();
  const { alerts } = weather.insights;
  if (!alerts.length) return null;

  return (
    <section className="alerts" aria-label={t("alert.label")}>
      {alerts.map((a) => {
        const Icon = ICONS[a.type];
        return (
          <div key={a.type} className={`alert alert--${a.severity}`} role="alert">
            <Icon size={22} strokeWidth={1.7} className="alert__icon" />
            <div className="alert__body">
              <p className="alert__title">
                {t(`alert.title.${a.type}`)} <span className="alert__level">{t(`alert.severity.${a.severity}`)}</span>
              </p>
              <p className="alert__text">{t(`alert.detail.${a.type}`, { value: alertValue(fmt, a.type, a.value), when: whenText(t, fmt, weather, a.date) })}</p>
            </div>
          </div>
        );
      })}
      <p className="alerts__note"><Info size={13} /> {t("alert.note")}</p>
    </section>
  );
}
