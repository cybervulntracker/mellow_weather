import { Sunrise, Sunset } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";

// Path of the lit part of the moon. `waxing` = growing (lit side on the right).
function moonPath(r, illumination, waxing) {
  const k = illumination / 100;
  const rx = Math.abs(1 - 2 * k) * r;
  const outerSweep = waxing ? 1 : 0;
  const crescent = k < 0.5;
  const innerSweep = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  return `M 0 ${-r} A ${r} ${r} 0 0 ${outerSweep} 0 ${r} A ${rx} ${r} 0 0 ${innerSweep} 0 ${-r} Z`;
}

export default function SunMoonCard() {
  const { weather } = useWeather();
  const { t, fmt } = usePrefs();
  const a = weather.astro;
  const hasSun = Boolean(a.sunrise && a.sunset);

  // sun position on a half-ellipse from sunrise (left) to sunset (right)
  const progress = hasSun ? a.sunProgress : 0;
  const sun = { x: 150 - 130 * Math.cos(Math.PI * progress), y: 100 - 80 * Math.sin(Math.PI * progress) };
  const waxing = a.moon.ageDays < 14.77;

  return (
    <section className="card sunmoon">
      <h2 className="card__title">{t("astro.title")}</h2>

      {hasSun ? (
        <>
          <svg viewBox="0 0 300 120" className="sunarc" role="img" aria-label={`${t("metric.sunrise")} ${fmt.clock(a.sunrise)}, ${t("metric.sunset")} ${fmt.clock(a.sunset)}`}>
            <path d="M 20 100 A 130 80 0 0 1 280 100" className="sunarc__track" />
            <line x1="10" y1="100" x2="290" y2="100" className="sunarc__horizon" />
            <circle cx={sun.x} cy={sun.y} r="9" className={a.isDaylight ? "sunarc__sun" : "sunarc__sun is-down"} />
          </svg>
          <div className="sunarc__times">
            <span><Sunrise size={15} /> {fmt.clock(a.sunrise)}</span>
            <span><Sunset size={15} /> {fmt.clock(a.sunset)}</span>
          </div>
          <div className="golden">
            <strong>{t("astro.golden")}</strong>
            <span>{t("astro.goldenMorning")}: {fmt.clock(a.goldenMorning.start)} – {fmt.clock(a.goldenMorning.end)}</span>
            <span>{t("astro.goldenEvening")}: {fmt.clock(a.goldenEvening.start)} – {fmt.clock(a.goldenEvening.end)}</span>
            <small className="muted">{t("astro.goldenNote")}</small>
          </div>
        </>
      ) : (
        <p className="muted small mt-8">{t("astro.polar")}</p>
      )}

      <div className="moon">
        <svg viewBox="-24 -24 48 48" width="52" height="52" aria-hidden="true">
          <circle r="20" className="moon__dark" />
          <path d={moonPath(20, a.moon.illumination, waxing)} className="moon__lit" />
        </svg>
        <div>
          <strong>{t(`moon.${a.moon.phase}`)}</strong>
          <span className="muted small">{t("astro.illuminated", { pct: a.moon.illumination })}</span>
        </div>
      </div>
    </section>
  );
}
