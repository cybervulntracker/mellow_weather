import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { usePrefs } from "../../context/PrefsContext";
import { useToast } from "../ui/Feedback";
import { formatRuleNumber } from "../../lib/insights";
import { toCelsius, toKmh } from "../../lib/units";
import PushToggle from "./PushToggle";

const METRICS = ["tempMax", "tempMin", "rainProb", "windMax", "uvMax", "aqi"];

export default function NotificationSettings() {
  const { user } = useAuth();
  const { t, fmt, unit, windUnit, updatePrefs } = usePrefs();
  const toast = useToast();
  const rules = useApi("/notifications/rules");
  const places = useApi("/weather/favorites");

  const [metric, setMetric] = useState("tempMax");
  const [threshold, setThreshold] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [busy, setBusy] = useState(false);

  // a person types temperatures and wind in their own units; the server stores °C and km/h
  const unitLabel = { tempMax: `°${unit}`, tempMin: `°${unit}`, rainProb: "%", windMax: windUnit === "ms" ? "m/s" : windUnit === "mph" ? "mph" : "km/h", uvMax: "", aqi: "" }[metric];
  const toStored = (value) => (metric === "tempMax" || metric === "tempMin" ? toCelsius(value, unit) : metric === "windMax" ? Math.round(toKmh(value, windUnit)) : value);
  const hasHome = rules.data?.hasHome;

  async function addRule(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/notifications/rules", { method: "POST", body: { metric, threshold: toStored(Number(threshold)), placeId: placeId || null } });
      setThreshold("");
      rules.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule) {
    try { await api(`/notifications/rules/${rule._id}`, { method: "PATCH", body: { enabled: !rule.enabled } }); rules.reload(); }
    catch (err) { toast.error(err.message); }
  }
  async function removeRule(rule) {
    try { await api(`/notifications/rules/${rule._id}`, { method: "DELETE" }); rules.reload(); }
    catch (err) { toast.error(err.message); }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card__head"><h2 className="card__title">{t("notif.title")}</h2></div>
        {!hasHome && rules.data && <div className="banner banner--warning mb-12">{t("ns.needHome")} <Link to="/weather/favorites">{t("nav.favorites")}</Link></div>}

        <label className="switch-row">
          <div><strong>{t("ns.digest")}</strong><span>{t("ns.digestHint")}</span></div>
          <input type="checkbox" className="switch" checked={user.notifyDailyDigest} onChange={(e) => updatePrefs({ notifyDailyDigest: e.target.checked })} />
        </label>
        {user.notifyDailyDigest && (
          <label className="field field--inline mt-12">
            <span className="field__label">{t("ns.digestHour")}</span>
            <select className="input select" value={user.notifyDigestHour} onChange={(e) => updatePrefs({ notifyDigestHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmt.hour(`2000-01-01T${String(h).padStart(2, "0")}:00`)}</option>)}
            </select>
          </label>
        )}
        <hr className="rule" />
        <PushToggle />
        <hr className="rule" />
        <label className="switch-row">
          <div><strong>{t("ns.rain")}</strong><span>{t("ns.rainHint")}</span></div>
          <input type="checkbox" className="switch" checked={user.notifyRainAlerts} onChange={(e) => updatePrefs({ notifyRainAlerts: e.target.checked })} />
        </label>
        <p className="muted small mt-12">{user.emailVerified ? t("ns.emailNote", { email: user.email }) : t("ns.unverified")}</p>
      </section>

      <section className="card">
        <div className="card__head"><h2 className="card__title">{t("rules.title")}</h2></div>
        <p className="muted small mb-12">{t("rules.hint")}</p>

        {rules.data?.rules.length ? (
          <ul className="rules">
            {rules.data.rules.map((r) => (
              <li key={r._id} className={r.enabled ? "" : "is-off"}>
                <div>
                  <strong>{t(`rules.metric.${r.metric}`)} {formatRuleNumber(fmt, r.metric, r.threshold)}</strong>
                  <span className="muted small">{r.placeName || t("rules.home")}</span>
                </div>
                <input type="checkbox" className="switch" checked={r.enabled} onChange={() => toggleRule(r)} aria-label={t("rules.enabled")} />
                <button className="icon-btn icon-btn--danger" onClick={() => removeRule(r)} aria-label={t("common.delete")}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">{t("rules.empty")}</p>}

        <form className="rules__form" onSubmit={addRule}>
          <select className="input select" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label={t("rules.add")}>
            {METRICS.map((m) => <option key={m} value={m}>{t(`rules.metric.${m}`)}</option>)}
          </select>
          <div className="input-suffix">
            <input className="input" type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} required aria-label={t("rules.value")} />
            {unitLabel && <span>{unitLabel}</span>}
          </div>
          <select className="input select" value={placeId} onChange={(e) => setPlaceId(e.target.value)} aria-label={t("rules.place")}>
            <option value="">{t("rules.home")}</option>
            {places.data?.filter((p) => !p.isHome).map((p) => <option key={p._id} value={p._id}>{p.nickname || p.city}</option>)}
          </select>
          <button className="btn btn--primary" disabled={busy || threshold === ""}>{busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} {t("rules.add")}</button>
        </form>
      </section>
    </div>
  );
}
