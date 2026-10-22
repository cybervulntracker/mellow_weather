import { Car, Footprints, Shirt, Trees } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";

const ICONS = { running: Footprints, laundry: Shirt, travel: Car, outdoors: Trees };

export default function RecommendationsCard() {
  const { weather } = useWeather();
  const { t } = usePrefs();
  return (
    <section>
      <h2 className="section-title">{t("rec.title")}</h2>
      <div className="recs">
        {weather.insights.recommendations.map((r) => {
          const Icon = ICONS[r.activity];
          return (
            <div key={r.activity} className={`rec rec--${r.rating}`}>
              <div className="rec__head">
                <Icon size={18} strokeWidth={1.7} />
                <strong>{t(`activity.${r.activity}`)}</strong>
                <span className={`rating rating--${r.rating}`}>{t(`rating.${r.rating}`)}</span>
              </div>
              <p>{r.reasons.map((key) => t(`reason.${key}`)).join(" · ")}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
