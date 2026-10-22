import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { api } from "../../lib/api";
import { usePrefs } from "../../context/PrefsContext";
import AuthShell from "./AuthShell";

export default function ForgotPassword() {
  const { t } = usePrefs();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.forgot.title")} subtitle={t("auth.forgot.sub")} footer={<Link to="/login">{t("auth.2fa.back")}</Link>}>
      {sent ? (
        <div className="notice-card">
          <MailCheck size={28} />
          <p>{t("auth.forgot.sent")}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="auth__form" noValidate>
          {error && <div className="banner banner--error" role="alert">{error}</div>}
          <label className="field">
            <span className="field__label">{t("auth.email")}</span>
            <input className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <button className="btn btn--primary btn--lg btn--block" disabled={busy || !email}>
            {busy && <Loader2 size={18} className="spin" />} {t("auth.forgot.send")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
