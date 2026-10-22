import { useMemo, useState } from "react";
import { Clock, Flame, Globe2, MapPin, Search, Trash2, X } from "lucide-react";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { formatDateTime, timeAgo } from "../../lib/format";
import { BarChart, Donut } from "../../components/ui/Viz";
import Counter from "../../components/ui/Counter";
import Reveal from "../../components/ui/Reveal";
import EmptyState from "../../components/ui/EmptyState";

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

export default function History() {
  const { history, viewPlace, deleteHistory, clearHistory } = useWeather();
  const { t, locale } = usePrefs();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");

  const stats = useMemo(() => {
    const total = history.reduce((a, h) => a + (h.count || 1), 0);
    const byCountry = {};
    history.forEach((h) => { const c = h.country || "—"; byCountry[c] = (byCountry[c] || 0) + (h.count || 1); });
    const top = [...history].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 6);
    const weekAgo = now - 7 * 86400000;
    const thisWeek = history.filter((h) => new Date(h.updatedAt).getTime() >= weekAgo).length;
    // searches per weekday, Monday first
    const perDay = Array(7).fill(0);
    history.forEach((h) => { perDay[(new Date(h.updatedAt).getDay() + 6) % 7] += h.count || 1; });
    return { total, countries: Object.keys(byCountry).filter((c) => c !== "—").length, top, thisWeek, byCountry, perDay };
  }, [history, now]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = history.filter((h) => !q || `${h.city} ${h.admin1 || ""} ${h.country || ""}`.toLowerCase().includes(q));
    return rows.sort((a, b) => (sort === "most" ? (b.count || 0) - (a.count || 0) : sort === "az" ? a.city.localeCompare(b.city) : new Date(b.updatedAt) - new Date(a.updatedAt)));
  }, [history, query, sort]);

  const groups = useMemo(() => {
    if (sort !== "recent") return [{ key: "all", label: null, rows: shown }];
    const today = dayStart(now);
    const buckets = { today: [], yesterday: [], week: [], earlier: [] };
    shown.forEach((h) => {
      const d = dayStart(h.updatedAt);
      (d >= today ? buckets.today : d >= today - 86400000 ? buckets.yesterday : d >= today - 6 * 86400000 ? buckets.week : buckets.earlier).push(h);
    });
    return Object.entries(buckets).filter(([, rows]) => rows.length).map(([key, rows]) => ({ key, label: t(`hist.group.${key}`), rows }));
  }, [shown, sort, t, now]);

  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" })), [locale]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("recent.subtitle")}</p>
          <h1 className="page-title">{t("recent.title")}</h1>
        </div>
        {history.length > 0 && <button className="btn btn--secondary" onClick={clearHistory}><Trash2 size={16} /> {t("recent.clearAll")}</button>}
      </div>

      {history.length === 0 ? (
        <EmptyState icon={Clock} title={t("recent.empty.title")} text={t("recent.empty.text")} />
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><span className="kpi__icon"><Search size={18} /></span><div><strong><Counter value={stats.total} /></strong><span>{t("hist.total")}</span></div></div>
            <div className="kpi"><span className="kpi__icon kpi__icon--cyan"><MapPin size={18} /></span><div><strong><Counter value={history.length} /></strong><span>{t("hist.places")}</span></div></div>
            <div className="kpi"><span className="kpi__icon kpi__icon--pink"><Globe2 size={18} /></span><div><strong><Counter value={stats.countries} /></strong><span>{t("hist.countries")}</span></div></div>
            <div className="kpi"><span className="kpi__icon kpi__icon--amber"><Flame size={18} /></span><div><strong><Counter value={stats.thisWeek} /></strong><span>{t("hist.week")}</span></div></div>
          </div>

          <Reveal className="grid-2">
            <section className="card">
              <div className="card__head"><h2 className="card__title">{t("hist.perDay")}</h2></div>
              <BarChart labels={weekdays} every={1} height={200} series={[{ key: "n", label: t("hist.searches"), color: "#6366f1", values: stats.perDay }]} />
            </section>
            <section className="card">
              <div className="card__head"><h2 className="card__title">{t("hist.byCountry")}</h2></div>
              <Donut size={170} centerLabel={t("hist.searches")} slices={Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))} />
            </section>
          </Reveal>

          <Reveal>
            <section className="card">
              <div className="card__head"><h2 className="card__title">{t("hist.top")}</h2></div>
              <ul className="topplaces">
                {stats.top.map((h, i) => (
                  <li key={h._id}>
                    <button onClick={() => viewPlace(h, "recent")}>
                      <span className="rank">{i + 1}</span>
                      <span className="topplaces__name"><strong>{h.city}</strong><small>{h.country}</small></span>
                      <span className="topplaces__bar"><i style={{ width: `${((h.count || 1) / (stats.top[0].count || 1)) * 100}%` }} /></span>
                      <b>{h.count || 1}×</b>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <div className="toolbar toolbar--plain">
            <label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("hist.filter")} aria-label={t("hist.filter")} />{query && <button onClick={() => setQuery("")} aria-label={t("common.clear")}><X size={14} /></button>}</label>
            <div className="segmented segmented--sm" role="group">
              {["recent", "most", "az"].map((s) => <button key={s} className={`segmented__btn ${sort === s ? "is-active" : ""}`} onClick={() => setSort(s)}>{t(`hist.sort.${s}`)}</button>)}
            </div>
          </div>

          {shown.length === 0 ? <p className="muted center-pad">{t("hist.noMatch")}</p> : groups.map((g) => (
            <section key={g.key} className="timeline">
              {g.label && <h3 className="timeline__label">{g.label}</h3>}
              <div className="card list">
                {g.rows.map((h) => (
                  <div className="list__row" key={h._id}>
                    <span className="list__icon"><MapPin size={18} /></span>
                    <button className="list__main" onClick={() => viewPlace(h, "recent")}>
                      <strong>{h.city}</strong>
                      <span>{[h.admin1, h.country].filter(Boolean).join(", ")}</span>
                    </button>
                    <div className="list__meta" title={formatDateTime(h.updatedAt)}>
                      <span>{timeAgo(h.updatedAt, t)}</span>
                      {h.count > 0 && <span className="muted small">{t("recent.searched", { n: h.count })}</span>}
                    </div>
                    <button className="icon-btn icon-btn--danger" onClick={() => deleteHistory(h)} aria-label={t("recent.remove", { city: h.city })}><X size={16} /></button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
