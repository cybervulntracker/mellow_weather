import { CloudOff, Info } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { greetingKey } from "../../lib/format";
import PlaceSearch from "../../components/weather/PlaceSearch";
import AlertsBanner from "../../components/weather/AlertsBanner";
import CurrentCard from "../../components/weather/CurrentCard";
import InsightsCard from "../../components/weather/InsightsCard";
import NowcastCard from "../../components/weather/NowcastCard";
import MetricsGrid from "../../components/weather/MetricsGrid";
import AirQualityCard from "../../components/weather/AirQualityCard";
import HourlyStrip from "../../components/weather/HourlyStrip";
import DailyList from "../../components/weather/DailyList";
import RecommendationsCard from "../../components/weather/RecommendationsCard";
import SunMoonCard from "../../components/weather/SunMoonCard";
import OfficialAlerts from "../../components/weather/OfficialAlerts";
import HourlyExplorer from "../../components/weather/HourlyExplorer";
import Reveal from "../../components/ui/Reveal";
import { RecentPanel, SavedPanel } from "../../components/weather/SidePanels";
import EmptyState from "../../components/ui/EmptyState";

export function PageSkeleton() {
  return (
    <div className="home-grid" aria-busy="true">
      <div className="home-main">
        <div className="skeleton" style={{ height: 230, borderRadius: 18 }} />
        <div className="metrics">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}
        </div>
        <div className="skeleton" style={{ height: 130 }} />
      </div>
      <aside className="home-aside">
        <div className="skeleton" style={{ height: 220 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </aside>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { t } = usePrefs();
  const { weather, loading, error, retry, search, locateMe } = useWeather();

  return (
    <div className="page">
      <div className="home-head">
        <div>
          <p className="eyebrow">{t(`greet.${greetingKey()}`, { name: user.username.split(" ")[0] })}</p>
          <h1 className="page-title">{t("home.title")}</h1>
        </div>
        <PlaceSearch onSelect={search} onLocate={locateMe} />
      </div>

      {error && weather && <div className="banner banner--error" role="alert">{error}</div>}
      {weather?.degraded && <div className="banner banner--warning" role="status"><Info size={14} /> {t("home.degraded")}</div>}

      {!weather && loading && <PageSkeleton />}

      {!weather && !loading && (
        <EmptyState icon={CloudOff} title={t("home.loadFailed")} text={error} action={<button className="btn btn--primary mt-12" onClick={retry}>{t("common.retry")}</button>} />
      )}

      {weather && (
        <div className="home-grid">
          <div className={`home-main ${loading ? "is-refreshing" : ""}`}>
            <OfficialAlerts />
            <AlertsBanner />
            <CurrentCard />
            <InsightsCard />
            <NowcastCard />
            <Reveal><HourlyExplorer /></Reveal>
            <Reveal><HourlyStrip hours={12} /></Reveal>
            <Reveal><MetricsGrid /></Reveal>
            <Reveal><AirQualityCard /></Reveal>
            <Reveal><DailyList /></Reveal>
            <Reveal><RecommendationsCard /></Reveal>
          </div>
          <aside className="home-aside">
            <SavedPanel />
            <RecentPanel />
            <SunMoonCard />
          </aside>
        </div>
      )}
    </div>
  );
}
