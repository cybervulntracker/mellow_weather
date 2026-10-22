import { useState } from "react";
import { MailWarning } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePrefs } from "../context/PrefsContext";
import { useToast } from "./ui/Feedback";

// Shown until the person confirms their email address.
export default function VerifyBanner() {
  const { user } = useAuth();
  const { t } = usePrefs();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;

  async function resend() {
    setBusy(true);
    try {
      await api("/auth/resend-verification", { method: "POST" });
      toast.success(t("verify.sent"));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verify-banner">
      <MailWarning size={16} />
      <span>{t("verify.banner", { email: user.email })}</span>
      <button className="link-btn link-btn--plain" onClick={resend} disabled={busy}>{t("verify.resend")}</button>
    </div>
  );
}
