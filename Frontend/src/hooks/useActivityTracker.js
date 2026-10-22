import { useEffect } from "react";
import { api } from "../lib/api";

const TICK_MS = 5000;          // how often we look at the clock
const IDLE_AFTER_MS = 60000;   // no mouse/keyboard/touch for 60s = idle
const SEND_EVERY_S = 30;       // report to the server every ~30s of activity

/**
 * Measures real "active time": the tab must be visible AND the person must
 * have moved the mouse, typed, scrolled or touched the screen in the last
 * minute. Idle or background tabs are not counted.
 */
export default function useActivityTracker(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    let lastInteraction = Date.now();
    let pending = 0; // active seconds not yet sent

    const markActive = () => { lastInteraction = Date.now(); };
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    function flush(useKeepalive = false) {
      if (pending <= 0) return;
      const seconds = pending;
      pending = 0;
      api("/track/heartbeat", {
        method: "POST",
        body: { seconds, page: window.location.pathname },
        keepalive: useKeepalive,
      }).catch(() => { pending += seconds; }); // try again next time
    }

    const timer = setInterval(() => {
      const visible = document.visibilityState === "visible";
      const recentlyActive = Date.now() - lastInteraction < IDLE_AFTER_MS;
      if (visible && recentlyActive) pending += TICK_MS / 1000;
      if (pending >= SEND_EVERY_S) flush();
    }, TICK_MS);

    const onHide = () => { if (document.visibilityState === "hidden") flush(true); };
    document.addEventListener("visibilitychange", onHide);
    const onPageHide = () => flush(true);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [enabled]);
}
