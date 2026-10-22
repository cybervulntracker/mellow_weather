import { Wind } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";

const POLLUTANTS = [["pm25", "PM2.5"], ["pm10", "PM10"], ["o3", "O₃"], ["no2", "NO₂"], ["so2", "SO₂"], ["co", "CO"]];

export default function AirQualityCard() {
  const { weather } = useWeather();
  const { t } = usePrefs();
  const air = weather.air;

  if (!air) {
    return (
      <section className="card air">
        <h2 className="card__title"><Wind size={16} /> {t("air.title")}</h2>
        <p className="muted small mt-8">{t("air.unavailable")}</p>
      </section>
    );
  }

  return (
    <section className="card air">
      <div className="card__head">
        <h2 className="card__title"><Wind size={16} /> {t("air.title")}</h2>
        <span className="muted small">{t("air.aqi")}</span>
      </div>

      <div className="air__top">
        <div className={`air__score aqi--${air.category}`}>{air.aqi}</div>
        <div>
          <strong className="air__category">{t(`aqi.${air.category}`)}</strong>
          <p className="muted small">{t(`aqi.advice.${air.category}`)}</p>
        </div>
      </div>

      <div className="aqi-scale" role="img" aria-label={`${t("air.aqi")} ${air.aqi}`}>
        <span className="aqi-scale__marker" style={{ left: `${Math.min(air.aqi, 500) / 5}%` }} />
      </div>

      <h3 className="air__sub">{t("air.pollutants")}</h3>
      <dl className="pollutants">
        {POLLUTANTS.filter(([key]) => air[key] != null).map(([key, label]) => (
          <div key={key}><dt>{label}</dt><dd>{air[key]}</dd></div>
        ))}
      </dl>

      <h3 className="air__sub">{t("air.pollen")}</h3>
      {air.pollen.available ? (
        <ul className="pollen">
          {air.pollen.items.map((p) => (
            <li key={p.key}><span>{t(`pollen.${p.key}`)}</span><span className={`level level--${p.level}`}>{t(`pollen.level.${p.level}`)}</span></li>
          ))}
        </ul>
      ) : (
        <p className="muted small">{t("air.pollenNA")}</p>
      )}
      {weather.pollenIndex && (
        <>
          <h3 className="air__sub">{t("air.pollenIndex")}</h3>
          <ul className="pollen-index">
            {weather.pollenIndex.items.map((p) => (
              <li key={p.key}><span>{t(`pollenIdx.${p.key}`)}</span><div className="bar"><i style={{ width: `${(p.index / weather.pollenIndex.max) * 100}%` }} /></div><b>{p.index}/{weather.pollenIndex.max}</b></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
