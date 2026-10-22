import { useState } from "react";
import { Copy, Download, Laptop, Loader2, Smartphone, ShieldCheck, ShieldOff, Tablet, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { usePrefs } from "../../context/PrefsContext";
import { useConfirm, useToast } from "../ui/Feedback";
import { timeAgo } from "../../lib/format";

const DEVICE_ICON = { Mobile: Smartphone, Tablet, Desktop: Laptop };

function TwoFactor() {
  const { user, setUser } = useAuth();
  const { t } = usePrefs();
  const toast = useToast();
  const [setup, setSetup] = useState(null);       // { secret, qr } while enabling
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(null);     // backup codes, shown once
  const [disabling, setDisabling] = useState(false);
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action, onDone) {
    setBusy(true);
    try { onDone(await action()); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  const start = () => run(() => api("/account/2fa/setup", { method: "POST" }), setSetup);
  const enable = (e) => {
    e.preventDefault();
    run(() => api("/account/2fa/enable", { method: "POST", body: { code } }), (data) => {
      setBackup(data.backupCodes);
      setSetup(null);
      setCode("");
      setUser((u) => ({ ...u, twoFactorEnabled: true }));
    });
  };
  const disable = (e) => {
    e.preventDefault();
    run(() => api("/account/2fa/disable", { method: "POST", body: user.passwordSet ? { password: proof } : { code: proof } }), () => {
      setDisabling(false);
      setProof("");
      setUser((u) => ({ ...u, twoFactorEnabled: false }));
    });
  };
  const copyCodes = () => navigator.clipboard?.writeText(backup.join("\n")).then(() => toast.success(t("sec.2fa.copied")));
  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([backup.join("\n")], { type: "text/plain" }));
    Object.assign(document.createElement("a"), { href: url, download: "mellowweather-backup-codes.txt" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">{t("sec.2fa.title")}</h2>
        <span className={`badge ${user.twoFactorEnabled ? "badge--success" : "badge--neutral"}`}>{user.twoFactorEnabled ? t("sec.2fa.on") : t("sec.2fa.off")}</span>
      </div>
      <p className="muted small">{t("sec.2fa.hint")}</p>

      {backup && (
        <div className="backup mt-12">
          <strong>{t("sec.2fa.backupTitle")}</strong>
          <p className="muted small">{t("sec.2fa.backupText")}</p>
          <ul className="backup__codes">{backup.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="btn-row">
            <button className="btn btn--secondary btn--sm" onClick={copyCodes}><Copy size={14} /> {t("sec.2fa.copy")}</button>
            <button className="btn btn--secondary btn--sm" onClick={downloadCodes}><Download size={14} /> {t("sec.2fa.download")}</button>
            <button className="btn btn--primary btn--sm" onClick={() => setBackup(null)}>{t("sec.2fa.done")}</button>
          </div>
        </div>
      )}

      {!user.twoFactorEnabled && !setup && !backup && (
        <button className="btn btn--primary mt-12" onClick={start} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} {t("sec.2fa.enable")}</button>
      )}

      {setup && (
        <form className="twofa mt-12" onSubmit={enable}>
          <img src={setup.qr} alt={t("sec.2fa.qr")} width="180" height="180" />
          <div>
            <p className="small">{t("sec.2fa.scan")}</p>
            <p className="muted small mt-8">{t("sec.2fa.orEnter")}</p>
            <code className="secret">{setup.secret}</code>
            <label className="field mt-12">
              <span className="field__label">{t("sec.2fa.enterCode")}</span>
              <input className="input input--code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" autoFocus />
            </label>
            <div className="btn-row mt-12">
              <button className="btn btn--primary" disabled={busy || code.replace(/\s/g, "").length !== 6}>{busy && <Loader2 size={16} className="spin" />} {t("sec.2fa.verify")}</button>
              <button type="button" className="btn btn--ghost" onClick={() => setSetup(null)}>{t("common.cancel")}</button>
            </div>
          </div>
        </form>
      )}

      {user.twoFactorEnabled && !disabling && !backup && (
        <button className="btn btn--secondary mt-12" onClick={() => setDisabling(true)}><ShieldOff size={16} /> {t("sec.2fa.disable")}</button>
      )}
      {disabling && (
        <form className="btn-row mt-12" onSubmit={disable}>
          <input className="input input--inline" type={user.passwordSet ? "password" : "text"} value={proof} onChange={(e) => setProof(e.target.value)} placeholder={user.passwordSet ? t("sec.2fa.disablePassword") : t("sec.2fa.disableCode")} autoFocus aria-label={user.passwordSet ? t("sec.2fa.disablePassword") : t("sec.2fa.disableCode")} />
          <button className="btn btn--danger" disabled={busy || !proof}>{t("sec.2fa.disable")}</button>
          <button type="button" className="btn btn--ghost" onClick={() => { setDisabling(false); setProof(""); }}>{t("common.cancel")}</button>
        </form>
      )}
    </section>
  );
}

function Devices() {
  const { t } = usePrefs();
  const toast = useToast();
  const { data, reload } = useApi("/account/devices");

  async function revoke(device) {
    try { await api(`/account/devices/${device._id}`, { method: "DELETE" }); toast.success(t("sec.devices.signedOut")); reload(); }
    catch (err) { toast.error(err.message); }
  }
  async function revokeOthers() {
    try { await api("/account/devices/revoke-others", { method: "POST" }); toast.success(t("sec.devices.signedOut")); reload(); }
    catch (err) { toast.error(err.message); }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">{t("sec.devices.title")}</h2>
        {data?.length > 1 && <button className="btn btn--secondary btn--sm" onClick={revokeOthers}>{t("sec.devices.signOutOthers")}</button>}
      </div>
      <ul className="devices">
        {data?.map((d) => {
          const Icon = DEVICE_ICON[d.device] || Laptop;
          return (
            <li key={d._id}>
              <Icon size={20} />
              <div>
                <strong>{d.browser} · {d.os} {d.current && <span className="badge badge--success">{t("sec.devices.current")}</span>}</strong>
                <span className="muted small">{d.ip || "—"} · {t("sec.devices.lastActive", { time: timeAgo(d.lastSeenAt, t) })}</span>
              </div>
              {!d.current && <button className="btn btn--ghost btn--sm" onClick={() => revoke(d)}>{t("sec.devices.signOut")}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DataAndDeletion() {
  const { user, logout } = useAuth();
  const { t } = usePrefs();
  const toast = useToast();
  const confirm = useConfirm();
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    try {
      const response = await api("/account/export", { raw: true });
      if (!response.ok) throw new Error(t("sec.data.failed"));
      const url = URL.createObjectURL(await response.blob());
      Object.assign(document.createElement("a"), { href: url, download: "mellowweather-my-data.json" }).click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  }

  async function remove(e) {
    e.preventDefault();
    const ok = await confirm({ title: t("sec.delete.confirmTitle"), message: t("sec.delete.confirmMessage"), confirmLabel: t("sec.delete.button"), danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await api("/account", { method: "DELETE", body: user.passwordSet ? { password: proof } : { confirm: proof } });
      await logout();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className="card__head"><h2 className="card__title">{t("sec.data.title")}</h2></div>
        <p className="muted small mb-12">{t("sec.data.hint")}</p>
        <button className="btn btn--secondary" onClick={download}><Download size={16} /> {t("sec.data.download")}</button>
      </section>

      <section className="card card--danger">
        <div className="card__head"><h2 className="card__title">{t("sec.delete.title")}</h2></div>
        <p className="muted small mb-12">{t("sec.delete.hint")}</p>
        <form className="btn-row" onSubmit={remove}>
          <input className="input input--inline" type={user.passwordSet ? "password" : "text"} value={proof} onChange={(e) => setProof(e.target.value)} placeholder={user.passwordSet ? t("sec.delete.password") : t("sec.delete.type")} aria-label={user.passwordSet ? t("sec.delete.password") : t("sec.delete.type")} />
          <button className="btn btn--danger" disabled={busy || !proof}>{busy ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />} {t("sec.delete.button")}</button>
        </form>
      </section>
    </>
  );
}

export default function SecurityPanel() {
  return (
    <div className="stack">
      <TwoFactor />
      <Devices />
      <DataAndDeletion />
    </div>
  );
}
