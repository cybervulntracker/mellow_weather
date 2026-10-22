import { useEffect, useRef, useState } from "react";

/**
 * "Puffy" — a little cloud creature who wanders the whole login page, hops, blinks, follows your
 * cursor with her eyes, covers them when you type a password and cheers when you sign in.
 *
 * mood: idle | curious | shy | sad | happy
 * Movement is a CSS transform transition between random spots; no animation library.
 */

const SPOTS = [
  [0.07, 0.82], [0.2, 0.16], [0.5, 0.9], [0.8, 0.16], [0.93, 0.82], [0.3, 0.92], [0.7, 0.92], [0.05, 0.1], [0.95, 0.1], [0.5, 0.06],
];

export function Puffy({ mood = "idle", look = { x: 0, y: 0 }, walking = false, flip = false, size = 120 }) {
  const eye = { x: look.x * 3.2, y: look.y * 2.4 };
  const shy = mood === "shy";
  return (
    <svg className={`puffy puffy--${mood} ${walking ? "is-walking" : ""}`} viewBox="0 0 140 130" width={size} height={size * (130 / 140)} role="img" aria-label="Puffy the cloud" style={{ transform: flip ? "scaleX(-1)" : undefined }}>
      <ellipse className="puffy__shadow" cx="70" cy="122" rx="36" ry="5" />
      <g className="puffy__legs">
        <rect className="puffy__leg puffy__leg--a" x="48" y="98" width="11" height="20" rx="5.5" />
        <rect className="puffy__leg puffy__leg--b" x="81" y="98" width="11" height="20" rx="5.5" />
      </g>
      <g className="puffy__body">
        <path className="puffy__cloud" d="M33 104c-15 0-26-9-26-22 0-12 9-21 21-22 1-17 15-30 33-30 15 0 27 9 32 22 3-1 6-2 10-2 16 0 28 12 28 28 0 15-11 26-26 26H33z" />
        <path className="puffy__shine" d="M30 66c3-14 14-24 28-26" />
        {/* sprout */}
        <g className="puffy__sprout"><path d="M70 30c0-9 4-15 10-18" fill="none" stroke="#2f9e63" strokeWidth="3.5" strokeLinecap="round" /><path d="M80 12c8-3 15 1 17 8-8 3-15 0-17-8z" fill="#42c47e" /></g>
        {/* cheeks */}
        <ellipse className="puffy__cheek" cx="42" cy="78" rx="9" ry="5.5" /><ellipse className="puffy__cheek" cx="100" cy="78" rx="9" ry="5.5" />
        {/* eyes */}
        <g className="puffy__eyes">
          {[52, 90].map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy="68" rx="10" ry="11.5" fill="#fff" stroke="#27324f" strokeWidth="2" />
              <g className="puffy__pupil" style={{ transform: `translate(${eye.x}px, ${eye.y}px)` }}>
                <circle cx={cx} cy="69" r="6.2" fill="#27324f" /><circle cx={cx + 2} cy="66.5" r="2.2" fill="#fff" />
              </g>
              <ellipse className="puffy__lid" cx={cx} cy="68" rx="10.6" ry="12" />
            </g>
          ))}
        </g>
        {/* mouth */}
        {mood === "sad" ? <path d="M62 88c5-5 13-5 18 0" fill="none" stroke="#27324f" strokeWidth="2.6" strokeLinecap="round" />
          : mood === "happy" ? <path d="M60 83c2 11 20 11 22 0z" fill="#ff7b93" stroke="#27324f" strokeWidth="2.4" strokeLinejoin="round" />
          : <path d="M62 84c4 6 14 6 18 0" fill="none" stroke="#27324f" strokeWidth="2.6" strokeLinecap="round" />}
        {mood === "sad" && <path className="puffy__tear" d="M43 80c-3 5-3 8 0 10 3-2 3-5 0-10z" />}
      </g>
      {/* paws that cover the eyes while a password is typed */}
      <g className={`puffy__paws ${shy ? "is-up" : ""}`}>
        <ellipse cx="52" cy="70" rx="14" ry="11" className="puffy__paw" /><ellipse cx="90" cy="70" rx="14" ry="11" className="puffy__paw" />
      </g>
    </svg>
  );
}

/** Wanders to a new random spot every few seconds; hops on the way; looks at the pointer. */
export default function Roamer({ mood, pointer }) {
  const [spot, setSpot] = useState({ x: 0.1, y: 0.78 });
  const [flip, setFlip] = useState(false);
  const [moving, setMoving] = useState(false);
  const [boxSize, setBoxSize] = useState({ w: 1200, h: 800 });
  const ref = useRef(null);
  const last = useRef(0);

  useEffect(() => {
    const measure = () => setBoxSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    let stop;
    const go = () => {
      let next;
      do { next = SPOTS[Math.floor(Math.random() * SPOTS.length)]; } while (next[0] === last.current);
      last.current = next[0];
      setSpot((prev) => { setFlip(next[0] < prev.x); return { x: next[0], y: next[1] }; });
      setMoving(true);
      setTimeout(() => setMoving(false), 3600);
      stop = setTimeout(go, 6500 + Math.random() * 3000);
    };
    stop = setTimeout(go, 1500);
    return () => clearTimeout(stop);
  }, []);

  // eyes follow the pointer, measured from the creature's own position
  const size = boxSize.w < 700 ? 86 : 118;
  const cx = spot.x * (boxSize.w - size) + size / 2;
  const cy = spot.y * (boxSize.h - size) + size / 2;
  const dx = pointer ? pointer.px - cx : 0, dy = pointer ? pointer.py - cy : 0;
  const dist = Math.hypot(dx, dy) || 1;
  const look = { x: Math.max(-1, Math.min(1, dx / Math.max(dist, 140))), y: Math.max(-1, Math.min(1, dy / Math.max(dist, 140))) };

  return (
    <div className="roamer" ref={ref} style={{ transform: `translate(${spot.x * (boxSize.w - size)}px, ${spot.y * (boxSize.h - size)}px)` }}>
      <div className={`roamer__hop ${moving ? "is-hopping" : ""}`}>
        <Puffy mood={mood} look={look} walking={moving} flip={flip} size={size} />
      </div>
    </div>
  );
}

/** Little helpers that drift around too: a raindrop buddy and a sun chick. */
export function Buddies() {
  return (
    <>
      <div className="buddy buddy--drop" aria-hidden="true">
        <svg viewBox="0 0 60 76" width="44"><path d="M30 4C20 22 8 32 8 48a22 22 0 0 0 44 0C52 32 40 22 30 4z" fill="#5eb8ff" /><path d="M18 46c0 6 4 11 9 12" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7" /><circle cx="23" cy="48" r="3.2" fill="#27324f" /><circle cx="37" cy="48" r="3.2" fill="#27324f" /><path d="M26 56c2 3 6 3 8 0" stroke="#27324f" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>
      </div>
      <div className="buddy buddy--sun" aria-hidden="true">
        <svg viewBox="0 0 70 70" width="46"><g stroke="#ffb703" strokeWidth="4" strokeLinecap="round">{Array.from({ length: 8 }).map((_, i) => <line key={i} x1="35" y1="4" x2="35" y2="11" transform={`rotate(${i * 45} 35 35)`} />)}</g><circle cx="35" cy="35" r="17" fill="#ffd166" /><circle cx="29" cy="33" r="2.6" fill="#27324f" /><circle cx="41" cy="33" r="2.6" fill="#27324f" /><ellipse cx="25" cy="40" rx="3.4" ry="2" fill="#ff9aa8" /><ellipse cx="45" cy="40" rx="3.4" ry="2" fill="#ff9aa8" /><path d="M30 41c2 3 8 3 10 0" stroke="#27324f" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
      </div>
      <div className="buddy buddy--bird" aria-hidden="true">
        <svg viewBox="0 0 64 40" width="40"><ellipse cx="30" cy="24" rx="16" ry="11" fill="#ff8fab" /><circle cx="46" cy="18" r="8" fill="#ff8fab" /><path d="M54 18l8 3-8 3z" fill="#ffb703" /><circle cx="48" cy="16" r="1.8" fill="#27324f" /><path className="buddy__wing" d="M22 22c4-12 14-14 20-12-3 8-9 14-20 12z" fill="#ffc2d1" /></svg>
      </div>
    </>
  );
}
