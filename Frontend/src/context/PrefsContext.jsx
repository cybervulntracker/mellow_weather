/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { makeT } from "../i18n";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/ui/Feedback";
import {
  DISTANCE_UNITS, PRECIP_UNITS, PRESSURE_UNITS, WIND_UNITS, clockText, dayText, hourText, placeTimeText, toDistance, toPrecip, toPressure, toTemp, toTempDelta, toWind, weekdayText,
} from "../lib/units";

const PrefsContext = createContext(null);
const LOCALES = { en: "en-IN", hi: "hi-IN" };

const readStored = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};

// Everything the screens need to show numbers and times the way this person prefers.
function createFormatters({ language, unit, windUnit, pressureUnit, precipUnit = "mm", distanceUnit = "km", clock }) {
  const locale = LOCALES[language] || LOCALES.en;
  return {
    t: makeT(language),
    locale,
    fmt: {
      temp: (c) => (c == null ? "—" : `${toTemp(c, unit)}°`),
      delta: (c) => `${toTempDelta(c, unit)}°`,
      wind: (kmh) => (kmh == null ? "—" : `${toWind(kmh, windUnit)} ${WIND_UNITS[windUnit]}`),
      pressure: (hpa) => (hpa == null ? "—" : `${toPressure(hpa, pressureUnit)} ${PRESSURE_UNITS[pressureUnit]}`),
      rain: (mm) => (mm == null ? "—" : `${toPrecip(mm, precipUnit)} ${PRECIP_UNITS[precipUnit]}`),
      distance: (km) => (km == null ? "—" : `${toDistance(km, distanceUnit)} ${DISTANCE_UNITS[distanceUnit]}`),
      clock: (iso) => (iso ? clockText(iso, clock) : "—"),
      hour: (iso) => hourText(iso, clock),
      weekday: (date) => weekdayText(date, locale),
      day: (date) => dayText(date, locale),
      placeTime: (iso) => placeTimeText(iso, clock, locale),
    },
  };
}

export function PrefsProvider({ children }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  // before sign-in (login page) the choice is kept in this browser only
  const [guest, setGuest] = useState(() => ({ theme: readStored("mellow:theme", "system"), language: readStored("mellow:lang", "en") }));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);

  const theme = user?.theme ?? guest.theme;
  const language = user?.language ?? guest.language;
  const unit = user?.preferredUnit ?? "C";
  const windUnit = user?.windUnit ?? "kmh";
  const pressureUnit = user?.pressureUnit ?? "hpa";
  const precipUnit = user?.precipUnit ?? "mm";
  const distanceUnit = user?.distanceUnit ?? "km";
  const clock = user?.clock ?? "12h";
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    try { localStorage.setItem("mellow:theme", theme); } catch { /* storage unavailable */ }
  }, [resolvedTheme, theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem("mellow:lang", language); } catch { /* storage unavailable */ }
  }, [language]);

  // Applies at once, then saves; if saving fails the old value comes back.
  const updatePrefs = useCallback(async (patch) => {
    if (!user) {
      setGuest((g) => ({ ...g, ...patch }));
      return;
    }
    const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, user[k]]));
    setUser((u) => ({ ...u, ...patch }));
    try {
      const data = await api("/users/me", { method: "PATCH", body: patch });
      setUser(data.user);
    } catch (error) {
      setUser((u) => ({ ...u, ...previous }));
      toast.error(error.message);
    }
  }, [user, setUser, toast]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, language, unit, windUnit, pressureUnit, precipUnit, distanceUnit, clock, updatePrefs, ...createFormatters({ language, unit, windUnit, pressureUnit, precipUnit, distanceUnit, clock }) }),
    [theme, resolvedTheme, language, unit, windUnit, pressureUnit, precipUnit, distanceUnit, clock, updatePrefs]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}

// Shows everything below in one fixed language (the admin console stays in English).
export function PrefsOverride({ language, children }) {
  const base = usePrefs();
  const value = useMemo(() => ({ ...base, language, ...createFormatters({ ...base, language }) }), [base, language]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
