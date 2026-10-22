import { useEffect, useState } from "react";
import { Activity, Download, Search, X } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { ACTION_FILTERS } from "../../lib/actions";
import { formatDateTime, timeAgo } from "../../lib/format";
import { useToast } from "../../components/ui/Feedback";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import UserDrawer from "../../components/admin/UserDrawer";
import { ActionPill, ErrorNote, OutcomeBadge, PageHeader, TableSkeleton, UserCell } from "../../components/admin/bits";

export default function ActivityLog() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [role, setRole] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const filters = new URLSearchParams();
  if (debouncedQ) filters.set("q", debouncedQ);
  if (action) filters.set("action", action);
  if (outcome) filters.set("outcome", outcome);
  if (role) filters.set("role", role);
  if (from) filters.set("from", from);
  if (to) filters.set("to", to);

  const query = new URLSearchParams(filters);
  query.set("page", page);
  query.set("limit", 20);
  const { data, loading, error, reload } = useApi(`/admin/activity?${query}`, { every: 15000 });

  const change = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const anyFilter = q || action || outcome || role || from || to;

  function clearFilters() {
    setQ(""); setDebouncedQ(""); setAction(""); setOutcome(""); setRole(""); setFrom(""); setTo(""); setPage(1);
  }

  async function exportCsv() {
    try {
      const res = await api(`/admin/activity/export?${filters}`, { raw: true });
      if (!res.ok) throw new Error("Export failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  }

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Every sign-in, search, favourite and profile change, as it happens."
        actions={<button className="btn btn--secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button>}
      />

      <section className="card card--flush">
        <div className="toolbar toolbar--wrap">
          <div className="search-field">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search descriptions" aria-label="Search activity" />
            {q && <button onClick={() => setQ("")} aria-label="Clear search"><X size={14} /></button>}
          </div>
          <select className="input select" value={action} onChange={change(setAction)} aria-label="Category">
            {ACTION_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select className="input select" value={outcome} onChange={change(setOutcome)} aria-label="Outcome">
            <option value="">Any outcome</option><option value="success">Successful</option><option value="failure">Failed</option>
          </select>
          <select className="input select" value={role} onChange={change(setRole)} aria-label="Role">
            <option value="">All roles</option><option value="user">Users</option><option value="admin">Admins</option>
          </select>
          <label className="date-field"><span>From</span><input type="date" className="input" value={from} max={to || undefined} onChange={change(setFrom)} /></label>
          <label className="date-field"><span>To</span><input type="date" className="input" value={to} min={from || undefined} onChange={change(setTo)} /></label>
          {anyFilter && <button className="btn btn--ghost btn--sm" onClick={clearFilters}>Clear filters</button>}
        </div>

        {error && !data && <div className="pad"><ErrorNote message={error} onRetry={reload} /></div>}
        {loading && !data && <div className="pad"><TableSkeleton rows={8} /></div>}

        {data && (data.logs.length === 0 ? (
          <EmptyState icon={Activity} title="No activity found" text={anyFilter ? "Nothing matches these filters." : "Activity will appear here as people use the site."} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th><th>Outcome</th></tr></thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log._id}>
                    <td className="nowrap" title={formatDateTime(log.occurredAt)}>
                      <span>{timeAgo(log.occurredAt || log.createdAt)}</span>
                      <span className="muted small block">{formatDateTime(log.occurredAt || log.createdAt)}</span>
                    </td>
                    <td><UserCell user={log.actorId} size={30} onClick={log.actorId ? () => setOpenId(log.actorId._id) : undefined} /></td>
                    <td><ActionPill action={log.action} /></td>
                    <td className="cell-wide">{log.description}{log.targetLabel && log.targetLabel !== log.description && <span className="muted small block">{log.targetLabel}</span>}</td>
                    <td><OutcomeBadge outcome={log.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {data && <div className="pad-x"><Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="events" /></div>}
      </section>

      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
