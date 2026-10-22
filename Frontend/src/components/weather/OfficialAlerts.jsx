import { ShieldAlert } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";

// Warnings issued by a national weather service (currently the US National Weather Service)
export default function OfficialAlerts() {
  const { weather } = useWeather();
  const { t } = usePrefs();
  const list = weather.officialAlerts || [];
  if (!list.length) return null;
  return (
    <section className="official" aria-label={t("official.title")}>
      {list.map((a, i) => (
        <details key={`${a.event}${i}`} className={`official__item official__item--${a.severity}`} open={i === 0}>
          <summary>
            <ShieldAlert size={20} />
            <span className="official__title"><strong>{a.event}</strong><small>{t("official.source", { source: a.source })}{a.ends && ` · ${t("official.until", { date: new Date(a.ends).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) })}`}</small></span>
            <span className="alert__level">{t(`alert.severity.${a.severity === "minor" ? "watch" : a.severity === "extreme" ? "severe" : a.severity === "severe" ? "severe" : "warning"}`)}</span>
          </summary>
          <p>{a.headline}</p>
          {a.description && <p className="muted small">{a.description}</p>}
          {a.area && <p className="muted small">{a.area}</p>}
        </details>
      ))}
    </section>
  );
}
