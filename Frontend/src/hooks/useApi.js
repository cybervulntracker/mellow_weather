import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * GET helper for admin pages. Keeps showing the previous data while a
 * refresh is in flight, and can poll with `every` (milliseconds).
 * `loading` is only true until the first answer for the current URL.
 */
export default function useApi(path, { every = 0 } = {}) {
  const [result, setResult] = useState({ path: null, data: null, error: "" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((data) => setResult({ path, data, error: "" }))
      .catch((err) => { if (err.name !== "AbortError") setResult({ path, data: null, error: err.message }); });
    return () => controller.abort();
  }, [path, tick]);

  useEffect(() => {
    if (!every) return undefined;
    const timer = setInterval(() => setTick((t) => t + 1), every);
    return () => clearInterval(timer);
  }, [every]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = result.path === path;

  return {
    data: current ? result.data : null,
    error: current ? result.error : "",
    loading: !current,
    reload,
  };
}
