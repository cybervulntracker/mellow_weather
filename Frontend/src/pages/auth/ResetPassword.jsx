import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { usePrefs } from "../../context/PrefsContext";
import AuthShell from "./AuthShell";

export default function ResetPassword() {
  const { t } = usePrefs();
  const token = useSearchParams()[0].get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("auth.passwordHint"));
    if (password !== confirm) return setError(t("auth.reset.mismatch"));
    setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.reset.title")} subtitle={t("auth.reset.sub")} footer={<Link to="/login">{t("auth.signin")}</Link>}>
      {!token ? (
        <div className="banner banner--error">{t("auth.reset.missing")}</div>
      ) : done ? (
        <div className="notice-card">
          <CheckCircle2 size={28} />
          <p>{t("auth.reset.done")}</p>
          <Link className="btn btn--primary" to="/login">{t("auth.signin")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="auth__form" noValidate>
          {error && <div className="banner banner--error" role="alert">{error}</div>}
          <label className="field">
            <span className="field__label">{t("auth.reset.new")}</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.passwordHint")} required autoFocus />
          </label>
          <label className="field">
            <span className="field__label">{t("auth.reset.confirm")}</span>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
          <button className="btn btn--primary btn--lg btn--block" disabled={busy || !password || !confirm}>
            {busy && <Loader2 size={18} className="spin" />} {t("auth.reset.button")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
