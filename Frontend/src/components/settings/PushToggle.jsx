import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { usePrefs } from "../../context/PrefsContext";
import { useToast } from "../ui/Feedback";

// Standard Web Push helper: the server gives a base64url public key, the browser wants bytes
const keyToBytes = (base64) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export default function PushToggle() {
  const { t } = usePrefs();
  const toast = useToast();
  const { data: site } = useApi("/public/settings");
  const status = useApi("/push/status");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration("/sw.js").then((reg) => reg?.pushManager.getSubscription()).then((sub) => setOn(Boolean(sub))).catch(() => {});
  }, []);

  if (!supported) return <p className="muted small">{t("push.unsupported")}</p>;
  if (status.data && !status.data.available) return <p className="muted small">{t("push.notConfigured")}</p>;
  if (!site?.vapidPublicKey) return null;

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(t("push.denied"));
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(site.vapidPublicKey) });
      await api("/push/subscribe", { method: "POST", body: sub.toJSON() });
      setOn(true);
      toast.success(t("push.enabled"));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub?.endpoint } });
      await sub?.unsubscribe();
      setOn(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="push">
      <span className="push__icon"><BellRing size={20} /></span>
      <div className="push__text"><strong>{t("push.title")}</strong><span>{t("push.hint")}</span></div>
      {on ? (
        <div className="btn-row">
          <button className="btn btn--secondary btn--sm" onClick={() => api("/push/test", { method: "POST" })}>{t("push.test")}</button>
          <button className="btn btn--danger-outline btn--sm" onClick={disable} disabled={busy}>{busy && <Loader2 size={14} className="spin" />} {t("push.turnOff")}</button>
        </div>
      ) : (
        <button className="btn btn--primary btn--sm" onClick={enable} disabled={busy}>{busy && <Loader2 size={14} className="spin" />} {t("push.turnOn")}</button>
      )}
    </div>
  );
}
