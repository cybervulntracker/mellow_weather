import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { usePrefs } from "../../context/PrefsContext";
import { homeFor } from "../../lib/routes";
import GoogleButton from "../../components/GoogleButton";
import AuthShell from "./AuthShell";

export default function Signup() {
  const { register, loginWithGoogle } = useAuth();
  const { t } = usePrefs();
  const navigate = useNavigate();
  const { data: site } = useApi("/public/settings");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = site ? site.allowRegistrations : true;
  const strength = Math.min(4, (password.length >= 8) + /[A-Z]/.test(password) + /[0-9]/.test(password) + /[^A-Za-z0-9]/.test(password));
  const level = password.length < 8 ? 0 : Math.max(strength, 1);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("auth.passwordHint"));
    setBusy(true);
    try {
      const { user } = await register(name, email, password);
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function google(credential) {
    setError("");
    try {
      const result = await loginWithGoogle(credential);
      if (result.user) navigate(homeFor(result.user), { replace: true });
      else navigate("/login", { replace: true }); // this account uses two-step sign-in: continue there
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthShell title={t("auth.createTitle")} subtitle={t("auth.createSub")}
      footer={<>{t("auth.haveAccount")} <Link to="/login">{t("auth.signin")}</Link></>}>
      {!open ? (
        <div className="banner banner--warning">{t("auth.closed")}</div>
      ) : (
        <>
          <form onSubmit={submit} className="auth__form" noValidate>
            {error && <div className="banner banner--error" role="alert">{error}</div>}

            <label className="field">
              <span className="field__label">{t("auth.fullName")}</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
            </label>

            <label className="field">
              <span className="field__label">{t("auth.email")}</span>
              <input className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <label className="field">
              <span className="field__label">{t("auth.password")}</span>
              <div className="input-wrap">
                <input className="input" type={show ? "text" : "password"} autoComplete="new-password" placeholder={t("auth.passwordHint")} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="input-wrap__btn" onClick={() => setShow((v) => !v)} aria-label={t("auth.showPassword")}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && (
                <div className="strength" aria-live="polite">
                  <div className="strength__bars">
                    {[1, 2, 3, 4].map((n) => <span key={n} className={level >= n ? `on on--${level}` : ""} />)}
                  </div>
                  <span className="muted small">{t(`auth.strength.${level}`)}</span>
                </div>
              )}
            </label>

            <button className="btn btn--primary btn--lg btn--block" disabled={busy || !name || !email || !password}>
              {busy && <Loader2 size={18} className="spin" />} {t("auth.create")}
            </button>
          </form>

          {site?.googleClientId && (
            <>
              <div className="divider"><span>{t("auth.or")}</span></div>
              <GoogleButton clientId={site.googleClientId} onCredential={google} text="signup_with" />
            </>
          )}
        </>
      )}
    </AuthShell>
  );
}
