/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useConfirm, useToast } from "../components/ui/Feedback";
import { usePrefs } from "./PrefsContext";

const WeatherContext = createContext(null);
const LAST_KEY = "mellow:last-place";

const readLast = () => {
  try { return JSON.parse(localStorage.getItem(LAST_KEY)); } catch { return null; }
};
const writeLast = (place) => {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(place)); } catch { /* storage unavailable */ }
};

// what the server needs to find exactly this place (never just a name, which can be ambiguous)
const placeRef = (p) => ({ name: p.name, admin1: p.admin1, country: p.country, countryCode: p.countryCode, latitude: p.latitude, longitude: p.longitude });

export function WeatherProvider({ children }) {
  const { t } = usePrefs();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const requestId = useRef(0);

  const refreshHistory = useCallback(async () => {
    try { setHistory(await api("/weather/history")); } catch { /* shown as empty */ }
  }, []);

  const refreshFavorites = useCallback(async () => {
    try { setFavorites(await api("/weather/favorites")); } catch { /* shown as empty */ }
    finally { setFavoritesLoading(false); }
  }, []);

  // payload: { name, admin1, country, latitude, longitude } | { latitude, longitude } | { city }
  const loadWeather = useCallback(async (payload, source) => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const data = await api("/weather", { method: "POST", body: { ...payload, source } });
      if (id !== requestId.current) return false; // a newer request replaced this one
      setWeather(data);
      writeLast(placeRef({ name: data.city, admin1: data.admin1, country: data.country, countryCode: data.countryCode, latitude: data.latitude, longitude: data.longitude }));
      return true;
    } catch (err) {
      if (id === requestId.current) setError(err.message);
      return false;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // First load: settings, saved places and history, then the home city (or last place, or the site default)
  useEffect(() => {
    let alive = true;
    (async () => {
      const [site, favs] = await Promise.all([
        api("/public/settings").catch(() => null),
        api("/weather/favorites").catch(() => []),
      ]);
      if (!alive) return;
      setSettings(site);
      setFavorites(favs);
      setFavoritesLoading(false);
      const home = favs.find((f) => f.isHome);
      const start = home ? { name: home.city, admin1: home.admin1, country: home.country, latitude: home.latitude, longitude: home.longitude }
        : readLast() || { city: site?.defaultCity || "New Delhi" };
      await loadWeather(start, "default");
    })();
    api("/weather/history").then((rows) => alive && setHistory(rows)).catch(() => {});
    return () => { alive = false; };
  }, [loadWeather]);

  const goHome = useCallback(() => {
    if (pathname !== "/weather") navigate("/weather");
  }, [pathname, navigate]);

  // `place` comes from the autocomplete list, so it already has exact coordinates
  const search = useCallback(async (place) => {
    goHome();
    const ok = await loadWeather(placeRef(place), "search");
    if (ok) refreshHistory();
  }, [goHome, loadWeather, refreshHistory]);

  // opening a saved or recent place: favourites and history rows use `city` for the name
  const viewPlace = useCallback((place, source) => {
    goHome();
    const payload = place.latitude != null
      ? { name: place.city, admin1: place.admin1, country: place.country, latitude: place.latitude, longitude: place.longitude }
      : { city: place.city }; // very old history rows have no coordinates
    return loadWeather(payload, source).then((ok) => { if (ok) refreshHistory(); return ok; });
  }, [goHome, loadWeather, refreshHistory]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return toast.error(t("search.noGps"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        goHome();
        loadWeather({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, "location").then((ok) => ok && refreshHistory());
      },
      () => toast.error(t("search.gpsDenied")),
      { timeout: 10000 }
    );
  }, [goHome, loadWeather, refreshHistory, toast, t]);

  const toggleFavorite = useCallback(async () => {
    if (!weather) return;
    try {
      if (weather.favoriteId) {
        await api(`/weather/favorites/${weather.favoriteId}`, { method: "DELETE" });
        setWeather((w) => ({ ...w, favoriteId: null, isHome: false }));
        toast.success(t("fav.removed", { city: weather.city }));
      } else {
        const fav = await api("/weather/favorites", {
          method: "POST",
          body: { name: weather.city, admin1: weather.admin1, country: weather.country, latitude: weather.latitude, longitude: weather.longitude },
        });
        setWeather((w) => ({ ...w, favoriteId: fav._id, isHome: fav.isHome }));
        toast.success(t("fav.added", { city: weather.city }));
      }
      refreshFavorites();
    } catch (err) {
      toast.error(err.message);
    }
  }, [weather, refreshFavorites, toast, t]);

  const removeFavorite = useCallback(async (fav) => {
    try {
      await api(`/weather/favorites/${fav._id}`, { method: "DELETE" });
      setWeather((w) => (w && w.favoriteId === fav._id ? { ...w, favoriteId: null, isHome: false } : w));
      toast.success(t("fav.removed", { city: fav.city }));
      refreshFavorites(); // the server may have promoted another place to "home"
    } catch (err) {
      toast.error(err.message);
    }
  }, [refreshFavorites, toast, t]);

  // rename and/or set as home
  const updateFavorite = useCallback(async (fav, patch) => {
    try {
      await api(`/weather/favorites/${fav._id}`, { method: "PATCH", body: patch });
      setWeather((w) => (w && w.favoriteId === fav._id && "isHome" in patch ? { ...w, isHome: patch.isHome } : w));
      await refreshFavorites();
    } catch (err) {
      toast.error(err.message);
    }
  }, [refreshFavorites, toast]);

  const reorderFavorites = useCallback(async (orderedIds) => {
    setFavorites((list) => orderedIds.map((id) => list.find((f) => f._id === id)).filter(Boolean)); // instant
    try {
      await api("/weather/favorites/order", { method: "PUT", body: { ids: orderedIds } });
    } catch (err) {
      toast.error(err.message);
      refreshFavorites();
    }
  }, [refreshFavorites, toast]);

  const deleteHistory = useCallback(async (item) => {
    try {
      await api(`/weather/history/${item._id}`, { method: "DELETE" });
      setHistory((list) => list.filter((h) => h._id !== item._id));
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  const clearHistory = useCallback(async () => {
    const ok = await confirm({ title: t("recent.clearConfirm.title"), message: t("recent.clearConfirm.message"), confirmLabel: t("recent.clearAll"), danger: true });
    if (!ok) return;
    try {
      await api("/weather/history", { method: "DELETE" });
      setHistory([]);
      toast.success(t("recent.cleared"));
    } catch (err) {
      toast.error(err.message);
    }
  }, [confirm, toast, t]);

  const value = useMemo(() => ({
    weather, loading, error, history, favorites, favoritesLoading, settings,
    search, viewPlace, locateMe, toggleFavorite, removeFavorite, updateFavorite, reorderFavorites, deleteHistory, clearHistory,
    retry: () => loadWeather(readLast() || { city: "New Delhi" }, "default"),
  }), [weather, loading, error, history, favorites, favoritesLoading, settings,
    search, viewPlace, locateMe, toggleFavorite, removeFavorite, updateFavorite, reorderFavorites, deleteHistory, clearHistory, loadWeather]);

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather must be used inside WeatherProvider");
  return ctx;
}
