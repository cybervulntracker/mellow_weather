import { useEffect, useRef, useState } from "react";

const prefersReduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 (or the previous value) up to `value`. Pure requestAnimationFrame, no library. */
export function useCountUp(value, { duration = 900, decimals = 0 } = {}) {
  const target = Number(value);
  const valid = Number.isFinite(target);
  const reduced = prefersReduced();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!valid || reduced) return undefined;
    const start = performance.now();
    const origin = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const next = origin + (target - origin) * (1 - (1 - p) ** 3); // ease-out cubic
      setShown(next);
      from.current = next;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, valid, reduced, duration]);
  const f = 10 ** decimals;
  const out = !valid ? 0 : reduced ? target : shown;
  return Math.round(out * f) / f;
}

/** True once the element has scrolled into view (and stays true). */
export function useInView(options = { threshold: 0.12 }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); io.disconnect(); } }, options);
    io.observe(el);
    return () => io.disconnect();
  }, [seen]); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, seen];
}

/** Pointer position relative to a box, as -1..1 (for gentle parallax and the mascot's eyes). */
export function usePointer() {
  const [p, setP] = useState({ x: 0, y: 0, px: 0, py: 0 });
  useEffect(() => {
    let raf = 0;
    const move = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setP({ x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1, px: e.clientX, py: e.clientY }));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);
  return p;
}

/** Width of an element in pixels (updates on resize), so SVG charts can draw at true size and keep their text readable. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
