import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Pause, Play } from "lucide-react";
import { usePrefs } from "../../context/PrefsContext";

// Live rain radar: OpenStreetMap base + RainViewer radar frames you can play like a short film.
export default function RadarMap({ latitude, longitude }) {
  const { t, fmt } = usePrefs();
  const holder = useRef(null);
  const mapRef = useRef(null);
  const radarLayer = useRef(null);
  const [radar, setRadar] = useState({ host: "", frames: [], failed: false });
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  // the map itself
  useEffect(() => {
    const map = L.map(holder.current, { zoomControl: true, scrollWheelZoom: false }).setView([latitude, longitude], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, className: "map-base", attribution: "© OpenStreetMap contributors" }).addTo(map);
    L.circleMarker([latitude, longitude], { radius: 7, color: "#fff", weight: 2, fillColor: "#2457e6", fillOpacity: 1 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; radarLayer.current = null; };
  }, [latitude, longitude]);

  // the list of radar images
  useEffect(() => {
    let alive = true;
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => { if (!r.ok) throw new Error("radar"); return r.json(); })
      .then((data) => {
        if (!alive) return;
        const frames = [...(data.radar?.past || []), ...(data.radar?.nowcast || [])];
        if (!frames.length) throw new Error("no frames");
        setRadar({ host: data.host, frames, failed: false });
        setIndex(Math.max(0, (data.radar?.past?.length || 1) - 1)); // start at the latest real image
      })
      .catch(() => alive && setRadar({ host: "", frames: [], failed: true }));
    return () => { alive = false; };
  }, []);

  // show the chosen frame
  useEffect(() => {
    const map = mapRef.current;
    const frame = radar.frames[index];
    if (!map || !frame) return;
    const layer = L.tileLayer(`${radar.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.7, maxNativeZoom: 7, maxZoom: 18 }).addTo(map);
    if (radarLayer.current) map.removeLayer(radarLayer.current);
    radarLayer.current = layer;
  }, [radar, index]);

  // play the loop
  useEffect(() => {
    if (!playing || radar.frames.length < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % radar.frames.length), 700);
    return () => clearInterval(timer);
  }, [playing, radar.frames.length]);

  const frame = radar.frames[index];
  const frameTime = frame ? new Date(frame.time * 1000) : null;
  const iso = frameTime && new Date(frameTime.getTime() - frameTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="radar">
      <div ref={holder} className="radar__map" />
      {radar.failed ? (
        <p className="banner banner--warning mt-12">{t("radar.unavailable")}</p>
      ) : (
        <div className="radar__controls">
          <button className="btn btn--secondary btn--sm" onClick={() => setPlaying((p) => !p)} disabled={radar.frames.length < 2}>
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? t("radar.pause") : t("radar.play")}
          </button>
          <input type="range" min="0" max={Math.max(radar.frames.length - 1, 0)} value={index} onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} aria-label={t("radar.title")} />
          <span className="radar__time">{iso ? fmt.clock(iso) : "…"}</span>
        </div>
      )}
      <div className="radar__legend"><span>{t("radar.light")}</span><i /><span>{t("radar.heavy")}</span></div>
      <p className="muted small mt-8">{t("radar.note")}</p>
    </div>
  );
}
