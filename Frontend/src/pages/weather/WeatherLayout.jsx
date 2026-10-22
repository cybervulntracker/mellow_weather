import { NavLink, Outlet } from "react-router-dom";
import { Megaphone } from "lucide-react";
import Logo from "../../components/ui/Logo";
import UserMenu from "../../components/weather/UserMenu";
import ThemeToggle from "../../components/ThemeToggle";
import NotificationsBell from "../../components/NotificationsBell";
import VerifyBanner from "../../components/VerifyBanner";
import WeatherSky from "../../components/weather/WeatherSky";
import { WeatherProvider, useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";

const LINKS = [
  { to: "/weather", key: "nav.today", end: true },
  { to: "/weather/forecast", key: "nav.forecast" },
  { to: "/weather/compare", key: "nav.compare" },
  { to: "/weather/trip", key: "nav.trip" },
  { to: "/weather/favorites", key: "nav.favorites" },
  { to: "/weather/history", key: "nav.recent" },
];

function Shell() {
  const { settings } = useWeather();
  const { t } = usePrefs();
  const siteName = settings?.siteName || t("app.name");

  return (
    <div className="wsite">
      <WeatherSky />
      <header className="wnav">
        <div className="wnav__inner">
          <NavLink to="/weather" className="wnav__brand" aria-label={siteName}>
            <Logo name={siteName} />
          </NavLink>

          <nav className="wnav__links" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `wnav__link ${isActive ? "is-active" : ""}`}>{t(l.key)}</NavLink>
            ))}
          </nav>

          <div className="wnav__right">
            <ThemeToggle />
            <NotificationsBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <VerifyBanner />
      {settings?.announcement && (
        <div className="announce">
          <Megaphone size={16} /> <span>{settings.announcement}</span>
        </div>
      )}

      <main className="wmain">
        <Outlet />
      </main>

      <footer className="wfooter">
        <span>© {new Date().getFullYear()} {siteName}</span>
        <span>{t("footer.data")}</span>
      </footer>
    </div>
  );
}

export default function WeatherLayout() {
  return (
    <WeatherProvider>
      <Shell />
    </WeatherProvider>
  );
}
