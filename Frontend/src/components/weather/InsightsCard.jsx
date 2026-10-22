import { CloudSun, Droplets, GlassWater, Shirt, ShieldAlert, Sun, Thermometer, Umbrella } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { lineText } from "../../lib/insights";

const TIP_ICONS = { umbrella: Umbrella, sunscreen: Sun, mask: ShieldAlert, hydrate: GlassWater, jacket: Shirt };

// "Expect rain after 4 PM. Take an umbrella." + how it compares with normal + why it feels the way it does
export default function InsightsCard() {
  const { weather } = useWeather();
  const { t, fmt } = usePrefs();
  const { sentences, tips, climate, feelsLike } = weather.insights;

  const feelsParams = (p) => ({ ...p, wind: p.windKmh != null ? fmt.wind(p.windKmh) : "" });

  return (
    <section className="card insights">
      <h2 className="card__title"><CloudSun size={16} /> {t("insight.title")}</h2>
      <p className="insights__summary">{sentences.map((s) => lineText(t, fmt, s)).join(" ")}</p>

      {tips.length > 0 && (
        <div className="chips mt-12">
          {tips.map((tip) => {
            const Icon = TIP_ICONS[tip];
            return <span key={tip} className="tip"><Icon size={14} /> {t(`tip.${tip}`)}</span>;
          })}
        </div>
      )}

      <div className="insights__rows">
        {climate && (
          <div className="insights__row">
            <Thermometer size={16} />
            <div>
              <strong>{climate.key === "typical" ? t("climate.typical") : t(`climate.${climate.key}`, { delta: fmt.delta(climate.deltaC) })}</strong>
              <span>{t("climate.normal", { temp: fmt.temp(climate.normalMeanC) })}</span>
            </div>
          </div>
        )}
        <div className="insights__row">
          <Droplets size={16} />
          <div>
            <strong>{t("feels.title", { temp: fmt.temp(weather.feelsLike) })}</strong>
            <span>{feelsLike.reasons.map((r) => t(`feels.${r.key}`, feelsParams(r.params))).join(" ")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
