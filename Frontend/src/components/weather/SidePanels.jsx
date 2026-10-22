import { Link } from "react-router-dom";
import { Clock, Home, MapPin, Star, X } from "lucide-react";
import WeatherIcon from "../ui/WeatherIcon";
import { Spinner } from "../ui/Feedback";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { timeAgo } from "../../lib/format";

export function SavedPanel() {
  const { favorites, favoritesLoading, viewPlace } = useWeather();
  const { t, fmt } = usePrefs();
  return (
    <section className="card side">
      <div className="card__head">
        <h2 className="card__title"><Star size={16} /> {t("panel.saved")}</h2>
        <Link to="/weather/favorites" className="link-sm">{t("common.viewAll")}</Link>
      </div>
      {favoritesLoading ? (
        <div className="side__loading"><Spinner /></div>
      ) : favorites.length === 0 ? (
        <p className="muted small">{t("panel.savedEmpty")}</p>
      ) : (
        <ul className="place-list">
          {favorites.slice(0, 5).map((f) => (
            <li key={f._id}>
              <button className="place" onClick={() => viewPlace(f, "favorite")}>
                <WeatherIcon name={f.icon} isDay={f.isDay} size={22} />
                <span className="place__text">
                  <strong>{f.nickname || f.city} {f.isHome && <Home size={12} className="place__home" aria-label={t("fav.home")} />}</strong>
                  <span>{[f.admin1, f.country].filter(Boolean).join(", ")}</span>
                </span>
                <span className="place__temp">{fmt.temp(f.temp)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentPanel() {
  const { history, viewPlace, deleteHistory } = useWeather();
  const { t } = usePrefs();
  return (
    <section className="card side">
      <div className="card__head">
        <h2 className="card__title"><Clock size={16} /> {t("recent.title")}</h2>
        <Link to="/weather/history" className="link-sm">{t("common.viewAll")}</Link>
      </div>
      {history.length === 0 ? (
        <p className="muted small">{t("panel.recentEmpty")}</p>
      ) : (
        <ul className="place-list">
          {history.slice(0, 5).map((h) => (
            <li key={h._id} className="place-row">
              <button className="place" onClick={() => viewPlace(h, "recent")}>
                <MapPin size={18} className="place__pin" />
                <span className="place__text">
                  <strong>{h.city}</strong>
                  <span>{[h.admin1, h.country].filter(Boolean).join(", ")} · {timeAgo(h.updatedAt, t)}</span>
                </span>
              </button>
              <button className="icon-btn icon-btn--danger" onClick={() => deleteHistory(h)} aria-label={t("recent.remove", { city: h.city })}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
