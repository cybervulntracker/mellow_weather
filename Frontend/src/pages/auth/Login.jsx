import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { usePrefs } from "../../context/PrefsContext";
import { homeFor } from "../../lib/routes";
import GoogleButton from "../../components/GoogleButton";
import AuthShell from "./AuthShell";

export default function Login() {
  const { login, verifyTwoFactor, loginWithGoogle, notice } = useAuth();
  const { t } = usePrefs();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: site } = useApi("/public/settings");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function arrive(user) {
    const from = location.state?.from;
    // only send people back to a page they're allowed to see
    const allowed = from && (user.role === "admin" || !from.startsWith("/admin"));
    navigate(allowed ? from : homeFor(user), { replace: true });
  }

  async function attempt(action) {
    setError("");
    setBusy(true);
    try {
      const result = await action();
      if (result?.twoFactorRequired) { setNeedsCode(true); setBusy(false); return; }
      arrive(result.user || result);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const submitPassword = (e) => { e.preventDefault(); attempt(() => login(email, password)); };
  const submitCode = (e) => { e.preventDefault(); attempt(() => verifyTwoFactor(code)); };

  if (needsCode) {
    return (
      <AuthShell title={t("auth.2fa.title")} subtitle={t("auth.2fa.sub")}
        footer={<button className="link-btn link-btn--plain" onClick={() => { setNeedsCode(false); setCode(""); setError(""); setBusy(false); }}>{t("auth.2fa.back")}</button>}>
        <form onSubmit={submitCode} className="auth__form" noValidate>
          {error && <div className="banner banner--error" role="alert">{error}</div>}
          <label className="field">
            <span className="field__label">{t("auth.2fa.code")}</span>
            <input className="input input--code" inputMode="text" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" autoFocus />
          </label>
          <button className="btn btn--primary btn--lg btn--block" disabled={busy || !code.trim()}>
            {busy && <Loader2 size={18} className="spin" />} {t("auth.2fa.verify")}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.welcome")} subtitle={t("auth.welcomeSub")}
      footer={<>{t("auth.noAccount")} <Link to="/signup">{t("auth.create")}</Link></>}>
      <form onSubmit={submitPassword} className="auth__form" noValidate>
        {(error || notice) && <div className="banner banner--error" role="alert">{error || notice}</div>}

        <label className="field">
          <span className="field__label">{t("auth.email")}</span>
          <input className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>

        <label className="field">
          <span className="field__label field__label--row">{t("auth.password")} <Link to="/forgot-password" className="link-sm">{t("auth.forgot")}</Link></span>
          <div className="input-wrap">
            <input className="input" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="input-wrap__btn" onClick={() => setShow((v) => !v)} aria-label={t("auth.showPassword")}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <button className="btn btn--primary btn--lg btn--block" disabled={busy || !email || !password}>
          {busy && <Loader2 size={18} className="spin" />} {t("auth.signin")}
        </button>
      </form>

      {site?.googleClientId && (
        <>
          <div className="divider"><span>{t("auth.or")}</span></div>
          <GoogleButton clientId={site.googleClientId} onCredential={(credential) => attempt(() => loginWithGoogle(credential))} />
        </>
      )}
    </AuthShell>
  );
}
