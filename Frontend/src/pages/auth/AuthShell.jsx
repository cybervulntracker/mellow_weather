import { useEffect, useRef, useState } from "react";
import { BellRing, CloudRain, LineChart, Radar, Sunrise, Wind } from "lucide-react";
import Logo from "../../components/ui/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import WeatherScene from "../../components/ui/WeatherScene";
import Roamer, { Buddies } from "./Mascot";
import { LANGUAGES } from "../../i18n";
import { usePrefs } from "../../context/PrefsContext";
import { usePointer } from "../../hooks/useMotion";

// Mirrored on both sides of the card so the page is symmetrical
const LEFT = [
  { icon: Radar, key: "radar", tone: "indigo" },
  { icon: BellRing, key: "alerts", tone: "amber" },
  { icon: CloudRain, key: "rain", tone: "cyan" },
];
const RIGHT = [
  { icon: Wind, key: "air", tone: "emerald" },
  { icon: Sunrise, key: "sun", tone: "pink" },
  { icon: LineChart, key: "trends", tone: "violet" },
];

function Chip({ icon: Icon, k, tone, i, side }) {
  const { t } = usePrefs();
  return (
    <div className={`achip achip--${tone}`} style={{ "--i": i, "--side": side }}>
      <span className="achip__icon"><Icon size={20} strokeWidth={1.9} /></span>
      <span className="achip__text"><strong>{t(`auth.chip.${k}`)}</strong><small>{t(`auth.chip.${k}.sub`)}</small></span>
    </div>
  );
}

// Centered card, mirrored feature chips either side, and Puffy wandering over the whole page.
export default function AuthShell({ title, subtitle, children, footer }) {
  const { t, language, updatePrefs, resolvedTheme } = usePrefs();
  const pointer = usePointer();
  const card = useRef(null);
  const [mood, setMood] = useState("idle");
  const [happy, setHappy] = useState(false);

  // Puffy reacts to what you do in the form: curious at text fields, shy at passwords, sad on errors
  useEffect(() => {
    const el = card.current;
    if (!el) return undefined;
    const onFocus = (e) => setMood(e.target.matches?.('input[type="password"], input[data-secret]') ? "shy" : e.target.matches?.("input") ? "curious" : "idle");
    const onBlur = () => setMood("idle");
    const onSubmit = () => { setHappy(true); setTimeout(() => setHappy(false), 1800); };
    el.addEventListener("focusin", onFocus);
    el.addEventListener("focusout", onBlur);
    el.addEventListener("submit", onSubmit);
    return () => { el.removeEventListener("focusin", onFocus); el.removeEventListener("focusout", onBlur); el.removeEventListener("submit", onSubmit); };
  }, []);

  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const el = card.current;
    if (!el) return undefined;
    const check = () => setHasError(Boolean(el.querySelector(".banner--error")));
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const shown = hasError && mood === "idle" ? "sad" : happy && !hasError ? "happy" : mood;

  return (
    <div className={`auth2 auth2--${resolvedTheme}`}>
      <div className="auth2__bg" aria-hidden="true">
        <span className="auth2__blob auth2__blob--a" /><span className="auth2__blob auth2__blob--b" /><span className="auth2__blob auth2__blob--c" />
        <WeatherScene kind={resolvedTheme === "dark" ? "night" : "sunny"} density={0.8} />
      </div>
      <Roamer mood={shown} pointer={pointer} />
      <Buddies />

      <header className="auth2__top"><Logo size={38} /></header>

      <main className="auth2__grid">
        <aside className="auth2__side auth2__side--left" aria-hidden="true">{LEFT.map((c, i) => <Chip key={c.key} {...c} k={c.key} i={i} side={-1} />)}</aside>

        <section className="auth2__card" ref={card}>
          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
          {footer && <p className="auth__footer">{footer}</p>}
        </section>

        <aside className="auth2__side auth2__side--right" aria-hidden="true">{RIGHT.map((c, i) => <Chip key={c.key} {...c} k={c.key} i={i} side={1} />)}</aside>
      </main>

      <footer className="auth2__foot">
        <select className="input select select--sm" value={language} onChange={(e) => updatePrefs({ language: e.target.value })} aria-label={t("prefs.language")}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <ThemeToggle />
      </footer>
    </div>
  );
}
