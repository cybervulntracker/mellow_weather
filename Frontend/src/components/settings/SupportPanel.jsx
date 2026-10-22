import { useState } from "react";
import { LifeBuoy, Loader2, Send } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { usePrefs } from "../../context/PrefsContext";
import { useToast } from "../ui/Feedback";
import { timeAgo } from "../../lib/format";
import EmptyState from "../ui/EmptyState";

const CATEGORIES = ["bug", "idea", "account", "other"];

// "Help": send a message to the admins and read their replies
export default function SupportPanel() {
  const { t } = usePrefs();
  const toast = useToast();
  const list = useApi("/support");
  const [form, setForm] = useState({ subject: "", category: "idea", text: "" });
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState("");

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/support", { method: "POST", body: form });
      setForm({ subject: "", category: "idea", text: "" });
      toast.success(t("support.sent"));
      list.reload();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  async function sendReply(ticket) {
    try { await api(`/support/${ticket._id}/reply`, { method: "POST", body: { text: reply } }); setReply(""); list.reload(); }
    catch (err) { toast.error(err.message); }
  }

  const tickets = list.data?.tickets || [];
  return (
    <div className="stack">
      <section className="card">
        <div className="card__head"><h2 className="card__title"><LifeBuoy size={16} /> {t("support.title")}</h2></div>
        <p className="muted small mb-12">{t("support.hint")}</p>
        <form className="stack" onSubmit={send}>
          <div className="chips" role="group" aria-label={t("support.category")}>
            {CATEGORIES.map((c) => <button type="button" key={c} className={`viz__chip ${form.category === c ? "is-on" : ""}`} onClick={() => setForm({ ...form, category: c })}>{t(`support.cat.${c}`)}</button>)}
          </div>
          <input className="input" required minLength={3} maxLength={120} placeholder={t("support.subject")} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className="input textarea" required minLength={5} maxLength={2000} placeholder={t("support.message")} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          <div className="btn-row"><button className="btn btn--primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} {t("support.send")}</button></div>
        </form>
      </section>

      <section className="card">
        <div className="card__head"><h2 className="card__title">{t("support.yours")}</h2></div>
        {tickets.length === 0 ? <EmptyState icon={LifeBuoy} title={t("support.empty")} text={t("support.emptyText")} /> : (
          <ul className="tickets">
            {tickets.map((k) => (
              <li key={k._id} className={`ticket ticket--${k.status}`}>
                <button className="ticket__head" onClick={() => setOpenId(openId === k._id ? null : k._id)}>
                  <strong>{k.subject}</strong>
                  <span className={`badge ${k.status === "answered" ? "badge--success" : k.status === "closed" ? "badge--neutral" : "badge--accent"}`}>{t(`support.status.${k.status}`)}</span>
                  <small className="muted">{timeAgo(k.updatedAt, t)}</small>
                </button>
                {openId === k._id && (
                  <div className="ticket__body">
                    {k.messages.map((m, i) => <div key={i} className={`bubble bubble--${m.from}`}><small>{m.from === "admin" ? t("support.team") : t("support.you")} · {timeAgo(m.at, t)}</small><p>{m.text}</p></div>)}
                    {k.status !== "closed" && (
                      <div className="ticket__reply"><input className="input" value={reply} maxLength={2000} placeholder={t("support.reply")} onChange={(e) => setReply(e.target.value)} /><button className="btn btn--primary btn--sm" disabled={!reply.trim()} onClick={() => sendReply(k)}><Send size={14} /></button></div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
