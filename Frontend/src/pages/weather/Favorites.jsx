import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, GripVertical, Home, MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import WeatherIcon from "../../components/ui/WeatherIcon";
import EmptyState from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Feedback";
import { BarChart } from "../../components/ui/Viz";
import Counter from "../../components/ui/Counter";
import Reveal from "../../components/ui/Reveal";
import { toTemp } from "../../lib/units";

export default function Favorites() {
  const { favorites, favoritesLoading, viewPlace, removeFavorite, updateFavorite, reorderFavorites } = useWeather();
  const { t, fmt, unit } = usePrefs();
  const [dragId, setDragId] = useState(null);
  const [editing, setEditing] = useState({ id: null, text: "" });

  const ids = favorites.map((f) => f._id);

  function move(id, offset) {
    const from = ids.indexOf(id);
    const to = from + offset;
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    reorderFavorites(next);
  }

  function drop(targetId) {
    if (dragId && dragId !== targetId) {
      const next = ids.filter((id) => id !== dragId);
      next.splice(next.indexOf(targetId), 0, dragId); // dropped card takes the place of the target
      reorderFavorites(next);
    }
    setDragId(null);
  }

  async function saveName(fav) {
    await updateFavorite(fav, { nickname: editing.text });
    setEditing({ id: null, text: "" });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("fav.subtitle")}</p>
          <h1 className="page-title">{t("fav.title")}</h1>
        </div>
        {favorites.length > 0 && <span className="muted small">{t("fav.count", { n: favorites.length })} · {t("fav.dragHint")}</span>}
      </div>

      {favoritesLoading ? (
        <div className="center-pad"><Spinner size={24} /></div>
      ) : favorites.length === 0 ? (
        <EmptyState icon={Star} title={t("fav.empty.title")} text={t("fav.empty.text")} />
      ) : (
        <>
        <FavSummary favorites={favorites} unit={unit} t={t} />
        <div className="fav-grid">
          {favorites.map((f, i) => (
            <article key={f._id} className={`fav card ${dragId === f._id ? "is-dragging" : ""}`} draggable
              onDragStart={() => setDragId(f._id)} onDragEnd={() => setDragId(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(f._id)}>
              <div className="fav__top">
                <div className="fav__titles">
                  {editing.id === f._id ? (
                    <input className="input input--sm" autoFocus value={editing.text} maxLength={40} placeholder={f.city} aria-label={t("fav.rename")}
                      onChange={(e) => setEditing({ id: f._id, text: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(f); if (e.key === "Escape") setEditing({ id: null, text: "" }); }} />
                  ) : (
                    <h3 className="fav__city">{f.nickname || f.city}{f.isHome && <span className="badge badge--accent fav__home"><Home size={11} /> {t("fav.home")}</span>}</h3>
                  )}
                  <p className="fav__country"><MapPin size={13} /> {[f.nickname ? f.city : "", f.admin1, f.country].filter(Boolean).join(", ")}</p>
                </div>
                <GripVertical size={18} className="fav__grip" aria-hidden="true" />
              </div>

              <div className="fav__temp">
                <span className="fav__number">{fmt.temp(f.temp)}</span>
                <WeatherIcon name={f.icon} isDay={f.isDay} size={34} strokeWidth={1.4} className="fav__icon" />
                <span className="fav__cond">{f.conditionKey ? t(`cond.${f.conditionKey}`) : "—"}</span>
              </div>

              <div className="fav__actions">
                <button className="btn btn--secondary btn--sm" onClick={() => viewPlace(f, "favorite")}>{t("fav.view")}</button>
                <div className="fav__tools">
                  <button className="icon-btn" onClick={() => move(f._id, -1)} disabled={i === 0} aria-label={t("fav.moveEarlier")} title={t("fav.moveEarlier")}><ChevronLeft size={16} /></button>
                  <button className="icon-btn" onClick={() => move(f._id, 1)} disabled={i === favorites.length - 1} aria-label={t("fav.moveLater")} title={t("fav.moveLater")}><ChevronRight size={16} /></button>
                  {editing.id === f._id
                    ? <button className="icon-btn" onClick={() => saveName(f)} aria-label={t("common.save")}><Check size={16} /></button>
                    : <button className="icon-btn" onClick={() => setEditing({ id: f._id, text: f.nickname || "" })} aria-label={t("fav.rename")} title={t("fav.rename")}><Pencil size={15} /></button>}
                  {!f.isHome && <button className="icon-btn" onClick={() => updateFavorite(f, { isHome: true })} aria-label={t("fav.setHome")} title={t("fav.setHome")}><Home size={15} /></button>}
                  <button className="icon-btn icon-btn--danger" onClick={() => removeFavorite(f)} aria-label={t("common.remove")} title={t("common.remove")}><Trash2 size={15} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

// A quick overview of everything you've saved
function FavSummary({ favorites, unit, t }) {
  const withTemp = favorites.filter((f) => f.temp != null);
  if (withTemp.length < 2) return null;
  const sorted = [...withTemp].sort((a, b) => b.temp - a.temp);
  const avg = Math.round(withTemp.reduce((a, f) => a + toTemp(f.temp, unit), 0) / withTemp.length);
  const name = (f) => f.nickname || f.city;
  return (
    <Reveal className="grid-2 fav-summary">
      <div className="kpis kpis--2">
        <div className="kpi"><span className="kpi__icon kpi__icon--amber">🔥</span><div><strong>{name(sorted[0])}</strong><span>{t("fav.hottest")} · {toTemp(sorted[0].temp, unit)}°</span></div></div>
        <div className="kpi"><span className="kpi__icon kpi__icon--cyan">❄️</span><div><strong>{name(sorted[sorted.length - 1])}</strong><span>{t("fav.coolest")} · {toTemp(sorted[sorted.length - 1].temp, unit)}°</span></div></div>
        <div className="kpi"><span className="kpi__icon">🌡️</span><div><strong><Counter value={avg} />°</strong><span>{t("fav.average")}</span></div></div>
        <div className="kpi"><span className="kpi__icon kpi__icon--pink">📍</span><div><strong><Counter value={favorites.length} /></strong><span>{t("fav.savedCount")}</span></div></div>
      </div>
      <div className="card">
        <div className="card__head"><h2 className="card__title">{t("fav.compareTemps")}</h2></div>
        <BarChart labels={sorted.map((f) => name(f).slice(0, 9))} every={1} height={170} format={(v) => `${v}°`} series={[{ key: "t", label: t("metric.temperature"), color: "#f59e0b", values: sorted.map((f) => toTemp(f.temp, unit)) }]} />
      </div>
    </Reveal>
  );
}
