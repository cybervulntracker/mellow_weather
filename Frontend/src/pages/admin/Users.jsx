import { useEffect, useState } from "react";
import { Ban, BadgeCheck, Eye, MailWarning, Search, ShieldCheck, ShieldOff, Trash2, UserCheck, Users as UsersIcon, X } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { formatDuration, formatNumber, timeAgo } from "../../lib/format";
import { useConfirm, useToast } from "../../components/ui/Feedback";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import UserDrawer from "../../components/admin/UserDrawer";
import { ErrorNote, PageHeader, RoleBadge, RowMenu, StatusBadge, TableSkeleton, UserCell } from "../../components/admin/bits";

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [picked, setPicked] = useState(() => new Set());

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page, limit: 12, sort });
  if (debouncedQ) params.set("q", debouncedQ);
  if (role) params.set("role", role);
  if (status) params.set("status", status);
  const { data, loading, error, reload } = useApi(`/admin/users?${params}`, { every: 20000 });

  async function patch(u, body, message) {
    try {
      await api(`/admin/users/${u._id}`, { method: "PATCH", body });
      toast.success(message);
      reload();
    } catch (err) { toast.error(err.message); }
  }

  async function remove(u) {
    const ok = await confirm({
      title: `Delete ${u.username}?`,
      message: "Their account, favourites, search history and sessions are permanently removed.",
      confirmLabel: "Delete account", danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/users/${u._id}`, { method: "DELETE" });
      toast.success("Account deleted");
      reload();
    } catch (err) { toast.error(err.message); }
  }

  const filtersActive = q || role || status;
  const selectable = (data?.users || []).filter((u) => u._id !== me._id);
  const allPicked = selectable.length > 0 && selectable.every((u) => picked.has(u._id));
  const togglePick = (id) => setPicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  async function bulk(action) {
    const ids = [...picked];
    const labels = { suspend: "Suspend", activate: "Reactivate", verify: "Mark as verified", delete: "Delete" };
    const ok = await confirm({
      title: `${labels[action]} ${ids.length} user${ids.length === 1 ? "" : "s"}?`,
      message: action === "delete" ? "Their accounts, favourites, search history and sessions are permanently removed." : "You can change this again later.",
      confirmLabel: labels[action], danger: action === "delete" || action === "suspend",
    });
    if (!ok) return;
    try {
      const result = await api("/admin/users/bulk", { method: "POST", body: { ids, action } });
      toast.success(result.skipped?.length ? `${result.message} (${result.skipped.length} skipped: ${result.skipped[0].reason})` : result.message);
      setPicked(new Set());
      reload();
    } catch (err) { toast.error(err.message); }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone with an account — their activity, role and access." />

      <section className="card card--flush">
        <div className="toolbar">
          <div className="search-field">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search users" />
            {q && <button onClick={() => setQ("")} aria-label="Clear search"><X size={14} /></button>}
          </div>
          <select className="input select" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
            <option value="">All roles</option><option value="admin">Admins</option><option value="user">Users</option>
          </select>
          <select className="input select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </select>
          <select className="input select" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort">
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option><option value="login">Last login</option>
          </select>
        </div>

        {picked.size > 0 && (
          <div className="bulkbar" role="toolbar" aria-label="Bulk actions">
            <strong>{picked.size} selected</strong>
            <button className="btn btn--secondary btn--sm" onClick={() => bulk("verify")}><BadgeCheck size={14} /> Mark verified</button>
            <button className="btn btn--secondary btn--sm" onClick={() => bulk("activate")}><UserCheck size={14} /> Reactivate</button>
            <button className="btn btn--secondary btn--sm" onClick={() => bulk("suspend")}><Ban size={14} /> Suspend</button>
            <button className="btn btn--danger btn--sm" onClick={() => bulk("delete")}><Trash2 size={14} /> Delete</button>
            <button className="link-btn link-btn--plain" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}

        {error && !data && <div className="pad"><ErrorNote message={error} onRetry={reload} /></div>}
        {loading && !data && <div className="pad"><TableSkeleton /></div>}

        {data && (data.users.length === 0 ? (
          <EmptyState icon={UsersIcon} title={filtersActive ? "No users match your filters" : "No users yet"} text={filtersActive ? "Try a different search or clear the filters." : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="check"><input type="checkbox" aria-label="Select all on this page" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(selectable.map((u) => u._id)))} /></th><th>User</th><th>Role</th><th>Status</th>
                  <th className="num">Active time</th><th className="num">Actions</th><th>Last login</th><th />
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const isSelf = u._id === me._id;
                  return (
                    <tr key={u._id} className={`is-clickable ${picked.has(u._id) ? "is-selected" : ""}`} onClick={() => setOpenId(u._id)}>
                      <td className="check" onClick={(e) => e.stopPropagation()}>{!isSelf && <input type="checkbox" aria-label={`Select ${u.username}`} checked={picked.has(u._id)} onChange={() => togglePick(u._id)} />}</td>
                      <td><UserCell user={u} /></td>
                      <td><RoleBadge role={u.role} />{u.twoFactorEnabled && <span className="mini-flag" title="Two-factor sign-in is on"><ShieldCheck size={14} /></span>}{!u.emailVerified && <span className="mini-flag mini-flag--warn" title="Email not verified"><MailWarning size={14} /></span>}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td className="num">{formatDuration(u.totalActiveSeconds)}</td>
                      <td className="num">{formatNumber(u.totalActions)}</td>
                      <td className="muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                      <td className="cell-actions">
                        <RowMenu items={[
                          { label: "View details", icon: Eye, onClick: () => setOpenId(u._id) },
                          { label: u.role === "admin" ? "Remove admin" : "Make admin", icon: u.role === "admin" ? ShieldOff : ShieldCheck, hidden: isSelf, onClick: () => patch(u, { role: u.role === "admin" ? "user" : "admin" }, u.role === "admin" ? "Admin rights removed" : "Promoted to admin") },
                          { label: u.status === "suspended" ? "Reactivate" : "Suspend", icon: u.status === "suspended" ? UserCheck : Ban, hidden: isSelf, onClick: () => patch(u, { status: u.status === "suspended" ? "active" : "suspended" }, u.status === "suspended" ? "Account reactivated" : "Account suspended") },
                          { label: "Delete account", icon: Trash2, danger: true, hidden: isSelf, onClick: () => remove(u) },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {data && <div className="pad-x"><Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="users" /></div>}
      </section>

      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </>
  );
}
