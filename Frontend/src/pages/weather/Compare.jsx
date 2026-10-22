import { useEffect, useState } from "react";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import PlaceSearch from "../../components/weather/PlaceSearch";
import WeatherIcon from "../../components/ui/WeatherIcon";
import EmptyState from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Feedback";

const MAX_PLACES = 4;
const same = (a, b) => Math.abs(a.latitude - b.latitude) < 0.02 && Math.abs(a.longitude - b.longitude) < 0.02;

export default function Compare() {
  const { t, fmt } = usePrefs();
  const { favorites } = useWeather();
  const [places, setPlaces] = useState([]);
  const [result, setResult] = useState({ key: "", items: [], error: "" });

  const key = places.map((p) => `${p.latitude},${p.longitude}`).join("|");
  const running = places.length >= 2 && result.key !== key;

  useEffect(() => {
    if (places.length < 2) return undefined;
    let alive = true;
    api("/weather/compare", { method: "POST", body: { places } })
      .then((data) => alive && setResult({ key, items: data.items, error: "" }))
      .catch((err) => alive && setResult({ key, items: [], error: err.message }));
    return () => { alive = false; };
  }, [key, places]);

  function add(place) {
    if (places.length >= MAX_PLACES || places.some((p) => same(p, place))) return;
    setPlaces((list) => [...list, { name: place.name, admin1: place.admin1 || "", country: place.country || "", latitude: place.latitude, longitude: place.longitude }]);
  }

  const addable = favorites.filter((f) => !places.some((p) => same(p, f)));
  const rows = [
    ["compare.row.temp", (d) => <strong className="cmp__big">{fmt.temp(d.temperature)}</strong>],
    ["compare.row.feels", (d) => fmt.temp(d.feelsLike)],
    ["compare.row.range", (d) => `${fmt.temp(d.high)} / ${fmt.temp(d.low)}`],
    ["compare.row.humidity", (d) => `${d.humidity}%`],
    ["compare.row.wind", (d) => fmt.wind(d.wind)],
    ["compare.row.rain", (d) => (d.precipitation != null ? `${d.precipitation}%` : "—")],
    ["compare.row.uv", (d) => (d.uvIndex != null ? d.uvIndex : "—")],
    ["compare.row.aqi", (d) => (d.aqi != null ? <span className={`aqi-pill aqi--${d.aqiCategory}`}>{d.aqi}</span> : "—")],
    ["compare.row.sunrise", (d) => fmt.clock(d.sunrise)],
    ["compare.row.sunset", (d) => fmt.clock(d.sunset)],
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("compare.subtitle", { n: MAX_PLACES })}</p>
          <h1 className="page-title">{t("compare.title")}</h1>
        </div>
      </div>

      <div className="card card--pad compare__picker">
        <div className="compare__chips">
          {places.map((p) => (
            <span className="chip-place" key={`${p.latitude},${p.longitude}`}>
              {p.name}<small>{p.country}</small>
              <button onClick={() => setPlaces((list) => list.filter((x) => x !== p))} aria-label={t("common.remove")}><X size={14} /></button>
            </span>
          ))}
        </div>
        {places.length < MAX_PLACES && (
          <div className="compare__add">
            <PlaceSearch onSelect={add} placeholder={t("compare.add")} />
            {addable.length > 0 && (
              <select className="input select" value="" onChange={(e) => { const f = favorites.find((x) => x._id === e.target.value); if (f) add({ name: f.city, admin1: f.admin1, country: f.country, latitude: f.latitude, longitude: f.longitude }); }} aria-label={t("compare.fromFavorites")}>
                <option value="">{t("compare.fromFavorites")}</option>
                {addable.map((f) => <option key={f._id} value={f._id}>{f.nickname || f.city}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {places.length < 2 && <EmptyState icon={ArrowLeftRight} title={t("compare.empty")} text={t("compare.emptyText")} />}
      {running && <div className="center-pad"><Spinner size={24} /></div>}
      {result.error && !running && <div className="banner banner--error mt-16">{result.error}</div>}

      {places.length >= 2 && !running && result.items.length > 0 && (
        <div className="card card--flush mt-16">
          <div className="table-wrap">
            <table className="table cmp">
              <thead>
                <tr><th />{result.items.map((i) => <th key={`${i.place.latitude},${i.place.longitude}`}>{i.place.name}<small>{i.place.country}</small></th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t("compare.row.now")}</th>
                  {result.items.map((i) => <td key={i.place.latitude}>{i.data ? <span className="cmp__cond"><WeatherIcon name={i.data.icon} isDay={i.data.isDay} size={22} /> {t(`cond.${i.data.conditionKey}`)}</span> : t("compare.failed")}</td>)}
                </tr>
                {rows.map(([label, render]) => (
                  <tr key={label}>
                    <th scope="row">{t(label)}</th>
                    {result.items.map((i) => <td key={i.place.latitude}>{i.data ? render(i.data) : "—"}</td>)}
                  </tr>
                ))}
                <tr className="cmp__section"><th scope="row" colSpan={result.items.length + 1}>{t("compare.week")}</th></tr>
                {result.items[0].data && Array.from({ length: 7 }, (_, d) => (
                  <tr key={d}>
                    <th scope="row">{d === 0 ? t("daily.today") : result.items[0].data.daily[d] ? fmt.weekday(result.items[0].data.daily[d].date) : ""}</th>
                    {result.items.map((i) => {
                      const day = i.data?.daily[d];
                      return <td key={i.place.latitude}>{day ? <span className="cmp__cond"><WeatherIcon name={day.icon} size={18} /> {fmt.temp(day.high)} / {fmt.temp(day.low)}</span> : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {places.length < 2 && places.length === 1 && <p className="muted small mt-12"><Plus size={13} /> {t("compare.addOne")}</p>}
    </div>
  );
}
