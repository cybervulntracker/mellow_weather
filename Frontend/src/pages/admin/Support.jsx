import { useState } from "react";
import { CheckCheck, Inbox, Send } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { timeAgo } from "../../lib/format";
import { useToast } from "../../components/ui/Feedback";
import EmptyState from "../../components/ui/EmptyState";
import { ErrorNote, PageHeader, UserCell } from "../../components/admin/bits";

const FILTERS = [["open", "Open"], ["answered", "Answered"], ["closed", "Closed"], ["", "All"]];
const CAT = { bug: "🐞 Bug", idea: "💡 Idea", account: "👤 Account", other: "💬 Other" };

export default function Support() {
  const toast = useToast();
  const [status, setStatus] = useState("open");
  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState("");
  const { data, error, reload } = useApi(`/admin/support${status ? `?status=${status}` : ""}`, { every: 30000 });

  async function send(ticket) {
    try { await api(`/admin/support/${ticket._id}/reply`, { method: "POST", body: { text: reply } }); setReply(""); toast.success("Reply sent"); reload(); }
    catch (err) { toast.error(err.message); }
  }
  async function mark(ticket, next) {
    try { await api(`/admin/support/${ticket._id}`, { method: "PATCH", body: { status: next } }); reload(); }
    catch (err) { toast.error(err.message); }
  }

  const counts = data?.counts || {};
  const tickets = data?.tickets || [];
  return (
    <>
      <PageHeader title="Support inbox" subtitle="Messages people send from Settings → Help. Replies show up in their notifications." />
      <div className="segmented mb-16" role="tablist">
        {FILTERS.map(([id, label]) => <button key={id} className={`segmented__btn ${status === id ? "is-active" : ""}`} onClick={() => setStatus(id)}>{label}{id && counts[id] ? <span className="count-pill">{counts[id]}</span> : null}</button>)}
      </div>
      {error && !data && <ErrorNote message={error} onRetry={reload} />}
      {data && tickets.length === 0 && <section className="card"><EmptyState icon={Inbox} title="Inbox zero 🎉" text="Nothing here for this filter." /></section>}
      <div className="stack">
        {tickets.map((k) => (
          <section key={k._id} className={`card ticket-card ticket-card--${k.status}`}>
            <button className="ticket-card__head" onClick={() => setOpenId(openId === k._id ? null : k._id)}>
              <UserCell user={k.userId} />
              <div className="ticket-card__subject"><strong>{k.subject}</strong><span>{CAT[k.category]} · {k.messages.length} message{k.messages.length === 1 ? "" : "s"}</span></div>
              <span className={`badge ${k.status === "open" ? "badge--accent" : k.status === "answered" ? "badge--success" : "badge--neutral"}`}>{k.status}</span>
              <small className="muted">{timeAgo(k.updatedAt)}</small>
            </button>
            {openId === k._id && (
              <div className="ticket__body">
                {k.messages.map((m, i) => <div key={i} className={`bubble bubble--${m.from === "admin" ? "user" : "admin"}`}><small>{m.from === "admin" ? "You (admin)" : k.userId?.username || "User"} · {timeAgo(m.at)}</small><p>{m.text}</p></div>)}
                <div className="ticket__reply">
                  <input className="input" placeholder="Write a reply…" value={reply} maxLength={2000} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) send(k); }} />
                  <button className="btn btn--primary btn--sm" disabled={!reply.trim()} onClick={() => send(k)}><Send size={14} /> Send</button>
                  {k.status !== "closed" ? <button className="btn btn--secondary btn--sm" onClick={() => mark(k, "closed")}><CheckCheck size={14} /> Close</button> : <button className="btn btn--secondary btn--sm" onClick={() => mark(k, "open")}>Reopen</button>}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
