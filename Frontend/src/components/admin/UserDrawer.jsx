import { useEffect, useState } from "react";
import { Ban, Clock, LogIn, MousePointerClick, ShieldCheck, ShieldOff, Trash2, UserCheck, X } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { actionMeta } from "../../lib/actions";
import { formatDate, formatDateTime, formatDuration, formatNumber, timeAgo } from "../../lib/format";
import Avatar from "../ui/Avatar";
import { BarList, ColumnChart } from "../ui/Charts";
import { useConfirm, useToast } from "../ui/Feedback";
import { Spinner } from "../ui/Feedback";
import { ErrorNote, RoleBadge, StatusBadge } from "./bits";

const COUNT_LABELS = {
  searches: "Searches", locationViews: "Places viewed", searchDeleted: "Searches deleted", historyCleared: "History cleared",
  favoriteAdded: "Favourites added", favoriteRemoved: "Favourites removed", profileUpdated: "Profile edits",
  avatarChanged: "Photo changes", other: "Sign-ins & other",
};

function lastDays(n) {
  return Array.from({ length: n }, (_, i) => new Date(Date.now() - (n - 1 - i) * 86400000).toISOString().slice(0, 10));
}

export default function UserDrawer({ userId, onClose, onChanged }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi(`/admin/users/${userId}`);
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function update(patch, successMessage) {
    setBusy(true);
    try {
      await api(`/admin/users/${userId}`, { method: "PATCH", body: patch });
      toast.success(successMessage);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${data.user.username}?`,
      message: "Their account, favourites, search history and sessions are permanently removed. Their activity log entries are kept for auditing.",
      confirmLabel: "Delete account",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/admin/users/${userId}`, { method: "DELETE" });
      toast.success("Account deleted");
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  const u = data?.user;
  const s = data?.summary;
  const isSelf = u && String(u._id) === String(me._id);

  const usage = s ? (() => {
    const map = Object.fromEntries((s.dailyUsage || []).map((d) => [d.date, d.actions]));
    return lastDays(14).map((date) => ({ date, value: map[date] || 0 }));
  })() : [];

  const counts = s ? Object.entries(s.actionCounts || {})
    .filter(([key, n]) => n > 0 && COUNT_LABELS[key])
    .map(([key, n]) => ({ key, label: COUNT_LABELS[key], value: n }))
    .sort((a, b) => b.value - a.value) : [];

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="User details" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>

        {loading && <div className="center-pad"><Spinner size={26} /></div>}
        {error && <ErrorNote message={error} onRetry={reload} />}

        {u && (
          <>
            <div className="drawer__head">
              <Avatar user={u} size={64} />
              <div className="drawer__id">
                <h2>{u.username}</h2>
                <p>{u.email}</p>
                <div className="chips">
                  <RoleBadge role={u.role} />
                  <StatusBadge status={u.status} />
                  {u.online && <span className="badge badge--live"><i className="live-dot" /> Online now</span>}
                  <span className={`badge ${u.emailVerified ? "badge--success" : "badge--neutral"}`}>{u.emailVerified ? "Email verified" : "Email not verified"}</span>
                  {u.twoFactorEnabled && <span className="badge badge--accent">2FA on</span>}
                  {u.authProvider === "google" && <span className="badge badge--neutral">Google</span>}
                </div>
              </div>
            </div>

            {!isSelf && (
              <div className="btn-row drawer__actions">
                <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => update({ role: u.role === "admin" ? "user" : "admin" }, u.role === "admin" ? "Admin rights removed" : "Promoted to admin")}>
                  {u.role === "admin" ? <><ShieldOff size={15} /> Remove admin</> : <><ShieldCheck size={15} /> Make admin</>}
                </button>
                <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => update({ status: u.status === "suspended" ? "active" : "suspended" }, u.status === "suspended" ? "Account reactivated" : "Account suspended")}>
                  {u.status === "suspended" ? <><UserCheck size={15} /> Reactivate</> : <><Ban size={15} /> Suspend</>}
                </button>
                <button className="btn btn--danger-outline btn--sm" disabled={busy} onClick={remove}><Trash2 size={15} /> Delete</button>
              </div>
            )}

            <div className="drawer__stats">
              <div className="mini-stat"><Clock size={16} /><strong>{formatDuration(s.totalActiveSeconds)}</strong><span>Active time</span></div>
              <div className="mini-stat"><MousePointerClick size={16} /><strong>{formatNumber(s.totalActions)}</strong><span>Actions</span></div>
              <div className="mini-stat"><LogIn size={16} /><strong>{formatNumber(u.loginCount)}</strong><span>Logins</span></div>
            </div>

            <div className="tabs" role="tablist">
              {[["overview", "Overview"], ["activity", "Activity"], ["sessions", "Sessions"], ["places", "Places"]].map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={`tabs__tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>

            <div className="drawer__body">
              {tab === "overview" && (
                <>
                  <dl className="kv">
                    <div><dt>Joined</dt><dd>{formatDate(u.createdAt)}</dd></div>
                    <div><dt>Last login</dt><dd>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</dd></div>
                    <div><dt>Last active</dt><dd>{s.lastActivityAt ? timeAgo(s.lastActivityAt) : "—"}</dd></div>
                    <div><dt>Sessions</dt><dd>{formatNumber(s.totalSessions)} · avg {formatDuration(s.averageSessionSeconds)} · longest {formatDuration(s.longestSessionSeconds)}</dd></div>
                    <div><dt>Preferences</dt><dd>°{u.preferredUnit} · {u.windUnit} · {u.clock} · {u.theme} · {u.language}</dd></div>
                    {u.bio && <div><dt>Bio</dt><dd>{u.bio}</dd></div>}
                    <div><dt>User ID</dt><dd className="mono">{u._id}</dd></div>
                  </dl>

                  <h3 className="drawer__h">Actions · last 14 days</h3>
                  <ColumnChart data={usage} height={110} />

                  <h3 className="drawer__h">What they do</h3>
                  <BarList items={counts} empty="No actions recorded yet." />
                </>
              )}

              {tab === "activity" && (
                data.activity.length === 0 ? <p className="muted small">No activity recorded yet.</p> : (
                  <ul className="feed">
                    {data.activity.map((log) => {
                      const meta = actionMeta(log.action);
                      const Icon = meta.icon;
                      return (
                        <li className="feed__item" key={log._id}>
                          <span className={`feed__icon tone-${meta.tone}`}><Icon size={14} /></span>
                          <div className="feed__body">
                            <span className="feed__text">{log.description}</span>
                            <span className="feed__time">{formatDateTime(log.occurredAt || log.createdAt)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}

              {tab === "sessions" && (
                data.sessions.length === 0 ? <p className="muted small">No sessions recorded yet.</p> : (
                  <ul className="feed">
                    {data.sessions.map((sess) => (
                      <li className="feed__item" key={sess._id}>
                        <span className="feed__icon tone-neutral"><LogIn size={14} /></span>
                        <div className="feed__body">
                          <span className="feed__text">{formatDateTime(sess.startedAt)} · {formatDuration(sess.activeSeconds)} active</span>
                          <span className="feed__time">{sess.browser} on {sess.os} · {sess.device}{sess.endedAt ? "" : " · still open"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {tab === "places" && (
                <>
                  <h3 className="drawer__h">Favourites ({data.favorites.length})</h3>
                  {data.favorites.length === 0 ? <p className="muted small">No saved places.</p> : (
                    <ul className="plain-list">{data.favorites.map((f) => <li key={f._id}><strong>{f.city}</strong><span>{f.country}</span></li>)}</ul>
                  )}
                  <h3 className="drawer__h">Recent searches</h3>
                  {data.searches.length === 0 ? <p className="muted small">No searches yet.</p> : (
                    <ul className="plain-list">{data.searches.map((q) => <li key={q._id}><strong>{q.city}</strong><span>{q.country} · {q.count || 1}× · {timeAgo(q.updatedAt)}</span></li>)}</ul>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
