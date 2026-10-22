import { useState } from "react";
import { CalendarDays, Droplet, Loader2, Luggage, X } from "lucide-react";
import { api } from "../../lib/api";
import { usePrefs } from "../../context/PrefsContext";
import PlaceSearch from "../../components/weather/PlaceSearch";
import WeatherIcon from "../../components/ui/WeatherIcon";
import EmptyState from "../../components/ui/EmptyState";

const dayString = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export default function Trip() {
  const { t, fmt } = usePrefs();
  const [place, setPlace] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setPlan(await api("/weather/trip", { method: "POST", body: { ...place, start, end } }));
    } catch (err) {
      setPlan(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("trip.subtitle")}</p>
          <h1 className="page-title">{t("trip.title")}</h1>
        </div>
      </div>

      <form className="card card--pad trip__form" onSubmit={submit}>
        <div className="field">
          <span className="field__label">{t("trip.place")}</span>
          {place ? (
            <span className="chip-place chip-place--lg">
              {place.name}<small>{[place.admin1, place.country].filter(Boolean).join(", ")}</small>
              <button type="button" onClick={() => setPlace(null)} aria-label={t("common.remove")}><X size={14} /></button>
            </span>
          ) : <PlaceSearch onSelect={(p) => setPlace({ name: p.name, admin1: p.admin1 || "", country: p.country || "", latitude: p.latitude, longitude: p.longitude })} placeholder={t("trip.placeholder")} />}
        </div>
        <label className="field">
          <span className="field__label">{t("trip.start")}</span>
          <input className="input" type="date" value={start} min={dayString(0)} max={dayString(365)} onChange={(e) => { setStart(e.target.value); if (end && e.target.value > end) setEnd(""); }} required />
        </label>
        <label className="field">
          <span className="field__label">{t("trip.end")}</span>
          <input className="input" type="date" value={end} min={start || dayString(0)} max={start ? new Date(Date.parse(start) + 13 * 86400000).toISOString().slice(0, 10) : dayString(365)} onChange={(e) => setEnd(e.target.value)} required />
        </label>
        <button className="btn btn--primary trip__go" disabled={busy || !place || !start || !end}>
          {busy ? <Loader2 size={16} className="spin" /> : <CalendarDays size={16} />} {t("trip.plan")}
        </button>
      </form>

      {error && <div className="banner banner--error mt-16" role="alert">{error}</div>}
      {!plan && !error && <EmptyState icon={Luggage} title={t("trip.empty")} text={t("trip.emptyText")} />}

      {plan && (
        <div className="stack mt-16">
          {plan.tips.length > 0 && (
            <div className="card card--pad">
              <h2 className="card__title"><Luggage size={16} /> {t("trip.packing")}</h2>
              <div className="chips mt-12">{plan.tips.map((tip) => <span key={tip} className="tip">{t(`tip.${tip}`)}</span>)}</div>
            </div>
          )}
          <div className="card list">
            {plan.days.map((d) => (
              <div className="list__row trip__day" key={d.date}>
                <div className="trip__date"><strong>{fmt.weekday(d.date)}</strong><span>{fmt.day(d.date)}</span></div>
                {d.kind === "unknown" ? <span className="muted">{t("trip.noData")}</span> : (
                  <>
                    <WeatherIcon name={d.icon} size={26} />
                    <div className="trip__summary">
                      <strong>{fmt.temp(d.high)} / {fmt.temp(d.low)}</strong>
                      <span className="muted small"><Droplet size={11} /> {d.kind === "forecast" ? t("trip.rainChance", { pct: d.rainChance }) : t("trip.typicalRain", { pct: d.rainChance })}</span>
                    </div>
                    <span className={`badge ${d.kind === "forecast" ? "badge--success" : "badge--neutral"}`}>{t(`trip.${d.kind}`)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
          {plan.days.some((d) => d.kind === "typical") && <p className="muted small">{t("trip.typicalNote")}</p>}
        </div>
      )}
    </div>
  );
}
