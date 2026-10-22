import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { usePrefs } from "../../context/PrefsContext";
import AuthShell from "./AuthShell";

// The link in the email lands here and confirms the address automatically.
export default function VerifyEmail() {
  const { t } = usePrefs();
  const { user, setUser } = useAuth();
  const token = useSearchParams()[0].get("token");
  const [result, setResult] = useState({ status: token ? "working" : "failed", message: "" });

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(() => {
        if (!alive) return;
        setResult({ status: "ok", message: "" });
        setUser((u) => (u ? { ...u, emailVerified: true } : u)); // hide the banner if they're signed in
      })
      .catch((err) => alive && setResult({ status: "failed", message: err.message }));
    return () => { alive = false; };
  }, [token, setUser]);

  const Icon = { working: Loader2, ok: CheckCircle2, failed: XCircle }[result.status];
  return (
    <AuthShell title={t("auth.verify.title")} subtitle="" footer={null}>
      <div className="notice-card">
        <Icon size={30} className={result.status === "working" ? "spin" : result.status === "ok" ? "text-success" : "text-danger"} />
        <p>{result.status === "working" ? t("auth.verify.working") : result.status === "ok" ? t("auth.verify.ok") : result.message || t("auth.verify.fail")}</p>
        {result.status !== "working" && <Link className="btn btn--primary" to={user ? "/" : "/login"}>{t("auth.verify.continue")}</Link>}
      </div>
    </AuthShell>
  );
}
