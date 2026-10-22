import { CloudRain } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";

// Rain in the next two hours, in 15-minute steps
export default function NowcastCard() {
  const { weather } = useWeather();
  const { t, fmt } = usePrefs();
  const nowcast = weather.nowcast;
  if (!nowcast) return null;

  const { status, minutes, intensity, slots, stepMin = 15 } = nowcast;
  const headline = status === "dry" ? t("nowcast.dry")
    : status === "rainSoon" ? t("nowcast.soon", { min: minutes })
    : minutes == null ? t("nowcast.rainingLong") : t("nowcast.rainingEnds", { min: minutes });
  const peak = Math.max(...slots.map((s) => s.mm), 0.5);

  return (
    <section className={`card nowcast nowcast--${status}`}>
      <div className="card__head">
        <h2 className="card__title"><CloudRain size={16} /> {t("nowcast.title")}</h2>
        {intensity && <span className="badge badge--accent">{t(`nowcast.intensity.${intensity}`)}</span>}
      </div>
      <p className="nowcast__headline">{headline}</p>
      <div className="nowcast__bars" aria-hidden="true">
        {slots.map((s) => (
          <div key={s.time} className="nowcast__col" title={`${fmt.clock(s.time)} · ${s.mm} mm`}>
            <div className="nowcast__bar" style={{ "--i": slots.indexOf(s), height: `${s.mm > 0 ? Math.max(12, (s.mm / peak) * 100) : 4}%` }} />
          </div>
        ))}
      </div>
      <div className="nowcast__axis"><span>{fmt.clock(slots[0].time)}</span><span>{fmt.clock(slots[slots.length - 1].time)}</span></div>
      <p className="muted small mt-8">{stepMin === 1 ? t("nowcast.noteMinute") : t("nowcast.note")}</p>
    </section>
  );
}
