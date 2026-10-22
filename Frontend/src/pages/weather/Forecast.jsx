import { lazy, Suspense, useState } from "react";
import { CloudOff, MapPin } from "lucide-react";
import useApi from "../../hooks/useApi";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { toTemp, toPrecip } from "../../lib/units";
import { BarChart, LineChart } from "../../components/ui/Viz";
import HourlyExplorer from "../../components/weather/HourlyExplorer";
import OfficialAlerts from "../../components/weather/OfficialAlerts";
import Reveal from "../../components/ui/Reveal";
import PlaceSearch from "../../components/weather/PlaceSearch";
import AlertsBanner from "../../components/weather/AlertsBanner";
import HourlyStrip from "../../components/weather/HourlyStrip";
import DailyList from "../../components/weather/DailyList";
import TempRainChart from "../../components/ui/TempRainChart";
import EmptyState from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Feedback";
import { PageSkeleton } from "./Home";

// the map library is only downloaded when someone opens the Radar tab
const RadarMap = lazy(() => import("../../components/weather/RadarMap"));

function TrendsTab({ weather }) {
  const { t, fmt, unit } = usePrefs();
  const { data, error, loading } = useApi(`/weather/trends?latitude=${weather.latitude}&longitude=${weather.longitude}`);
  const labels = { title: t("trends.title"), high: t("trends.high"), low: t("trends.low"), rain: t("trends.rain") };
  const week = weather.daily.map((d) => ({ date: d.date, high: d.high, low: d.low, rain: d.rainMm }));
  const month = data?.days.map((d) => ({ date: d.date, high: d.max, low: d.min, rain: d.precip }));

  return (
    <div className="stack">
      <section>
        <h2 className="section-title">{t("trends.week")}</h2>
        <div className="card card--pad"><TempRainChart days={week} unit={unit} formatDay={fmt.day} labels={labels} /></div>
      </section>
      <section>
        <h2 className="section-title">{t("trends.month")}</h2>
        <div className="card card--pad">
          {loading ? <div className="center-pad"><Spinner /></div>
            : error || !month ? <p className="muted small">{t("trends.unavailable")}</p>
            : <TempRainChart days={month} unit={unit} formatDay={fmt.day} labels={labels} />}
        </div>
      </section>
    </div>
  );
}

// Seven days at a glance: highs and lows as lines, rainfall as bars
function WeekGlance({ weather }) {
  const { t, fmt, unit, precipUnit } = usePrefs();
  const labels = weather.daily.map((d, i) => (i === 0 ? t("daily.today") : fmt.weekday(d.date).slice(0, 3)));
  return (
    <section className="grid-2">
      <div className="card">
        <div className="card__head"><h2 className="card__title">{t("forecast.week")}</h2></div>
        <LineChart labels={labels} every={1} height={230} format={(v) => `${v}°`}
          series={[{ key: "hi", label: t("trends.high"), color: "#f59e0b", values: weather.daily.map((d) => toTemp(d.high, unit)) }, { key: "lo", label: t("trends.low"), color: "#6366f1", values: weather.daily.map((d) => toTemp(d.low, unit)) }]} />
      </div>
      <div className="card">
        <div className="card__head"><h2 className="card__title">{t("forecast.rainWeek")}</h2></div>
        <BarChart labels={labels} every={1} height={230} format={(v) => `${v}`} series={[{ key: "rain", label: `${t("trends.rain")} (${precipUnit})`, color: "#06b6d4", values: weather.daily.map((d) => toPrecip(d.rainMm, precipUnit)) }]} />
      </div>
    </section>
  );
}

export default function Forecast() {
  const { weather, loading, search, locateMe } = useWeather();
  const { t } = usePrefs();
  const [tab, setTab] = useState("forecast");
  const region = weather && [weather.admin1, weather.country].filter(Boolean).join(", ");

  return (
    <div className="page">
      <div className="home-head">
        <div>
          <p className="eyebrow">{weather ? <><MapPin size={13} /> {weather.city}{region && `, ${region}`}</> : t("nav.forecast")}</p>
          <h1 className="page-title">{t("forecast.title")}</h1>
        </div>
        <PlaceSearch onSelect={search} onLocate={locateMe} />
      </div>

      {!weather && loading && <PageSkeleton />}
      {!weather && !loading && <EmptyState icon={CloudOff} title={t("forecast.empty")} text={t("forecast.emptyText")} />}

      {weather && (
        <div className={`stack ${loading ? "is-refreshing" : ""}`}>
          <OfficialAlerts />
          <AlertsBanner />
          <div className="segmented" role="tablist">
            {["forecast", "trends", "radar"].map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`segmented__btn ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>{t(`forecast.tab.${id}`)}</button>
            ))}
          </div>

          {tab === "forecast" && (
            <>
              <HourlyExplorer />
              <Reveal><HourlyStrip hours={24} /></Reveal>
              <Reveal><WeekGlance weather={weather} /></Reveal>
              <Reveal><DailyList /></Reveal>
            </>
          )}
          {tab === "trends" && <TrendsTab weather={weather} />}
          {tab === "radar" && (
            <Suspense fallback={<div className="center-pad"><Spinner size={24} /></div>}>
              <div className="card card--pad"><RadarMap latitude={weather.latitude} longitude={weather.longitude} /></div>
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
