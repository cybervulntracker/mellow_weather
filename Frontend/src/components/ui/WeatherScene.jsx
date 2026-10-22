import { useMemo } from "react";

// Deterministic pseudo-random so the particles don't jump around on every render
const rand = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

/**
 * Animated sky for a weather condition: sunny | night | cloudy | rain | storm | snow | fog.
 * Pure CSS animation on a handful of spans; sits behind content (position:absolute, inset:0).
 */
export default function WeatherScene({ kind = "sunny", density = 1 }) {
  const drops = useMemo(() => Array.from({ length: Math.round((kind === "storm" ? 46 : 34) * density) }, (_, i) => ({
    left: rand(i + 1) * 100, delay: rand(i + 7) * 2, dur: 0.55 + rand(i + 3) * 0.5, h: 14 + rand(i + 5) * 16, o: 0.35 + rand(i + 9) * 0.5,
  })), [kind, density]);
  const flakes = useMemo(() => Array.from({ length: Math.round(34 * density) }, (_, i) => ({
    left: rand(i + 11) * 100, delay: rand(i + 2) * 8, dur: 6 + rand(i + 4) * 6, s: 3 + rand(i + 6) * 6, drift: (rand(i + 8) - 0.5) * 60,
  })), [density]);
  const stars = useMemo(() => Array.from({ length: Math.round(34 * density) }, (_, i) => ({
    left: rand(i + 21) * 100, top: rand(i + 22) * 70, delay: rand(i + 23) * 4, s: 1 + rand(i + 24) * 2.2,
  })), [density]);

  const clouds = kind !== "night" && kind !== "sunny" ? 4 : kind === "sunny" ? 2 : 1;
  return (
    <div className={`scene scene--${kind}`} aria-hidden="true">
      {kind === "sunny" && <><span className="scene__sun" /><span className="scene__rays" /></>}
      {kind === "night" && <><span className="scene__moon" />{stars.map((s, i) => <span key={i} className="scene__star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.s, height: s.s, animationDelay: `${s.delay}s` }} />)}</>}
      {Array.from({ length: clouds }).map((_, i) => (
        <span key={i} className="scene__cloud" style={{ top: `${6 + i * 17}%`, animationDuration: `${46 + i * 14}s`, animationDelay: `${-i * 15}s`, transform: `scale(${0.7 + i * 0.22})`, opacity: kind === "sunny" ? 0.55 : 0.34 + i * 0.05 }} />
      ))}
      {(kind === "rain" || kind === "storm") && drops.map((d, i) => <span key={i} className="scene__drop" style={{ left: `${d.left}%`, height: d.h, opacity: d.o, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }} />)}
      {kind === "storm" && <span className="scene__flash" />}
      {kind === "snow" && flakes.map((f, i) => <span key={i} className="scene__flake" style={{ left: `${f.left}%`, width: f.s, height: f.s, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`, "--drift": `${f.drift}px` }} />)}
      {kind === "fog" && <><span className="scene__fog" /><span className="scene__fog scene__fog--b" /></>}
    </div>
  );
}
