import { Ban, KeyRound, ShieldAlert, ShieldCheck, UserX } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { formatDateTime, timeAgo } from "../../lib/format";
import { useToast } from "../../components/ui/Feedback";
import EmptyState from "../../components/ui/EmptyState";
import { ActionPill, ErrorNote, PageHeader, StatCard, UserCell } from "../../components/admin/bits";

function EventTable({ rows, empty }) {
  if (!rows.length) return <p className="muted small pad">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>When</th><th>Account</th><th>Event</th><th>Details</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l._id}>
              <td className="nowrap" title={formatDateTime(l.occurredAt)}>{timeAgo(l.occurredAt || l.createdAt)}</td>
              <td><UserCell user={l.actorId} size={28} /></td>
              <td><ActionPill action={l.action} /></td>
              <td className="cell-wide">{l.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Security() {
  const toast = useToast();
  const { data, error, reload } = useApi("/admin/security", { every: 30000 });

  async function reactivate(u) {
    try {
      await api(`/admin/users/${u._id}`, { method: "PATCH", body: { status: "active" } });
      toast.success(`${u.username} reactivated`);
      reload();
    } catch (err) { toast.error(err.message); }
  }

  if (error && !data) return <><PageHeader title="Security" /><ErrorNote message={error} onRetry={reload} /></>;
  if (!data) return <><PageHeader title="Security" subtitle="Loading…" /><div className="skeleton" style={{ height: 300 }} /></>;

  return (
    <>
      <PageHeader title="Security" subtitle="Failed sign-ins, account restrictions and admin changes." />

      <div className="stats stats--4">
        <StatCard icon={ShieldAlert} label="Failed sign-ins" value={data.summary.failed24h} sub="Last 24 hours" />
        <StatCard icon={Ban} label="Blocked sign-ins" value={data.summary.blocked24h} sub="Suspended accounts · 24h" />
        <StatCard icon={UserX} label="Suspended accounts" value={data.summary.suspended} sub="Currently restricted" />
        <StatCard icon={ShieldCheck} label="Admin changes" value={data.summary.adminChanges} sub="Recent role & access changes" />
      </div>

      <section className="card card--flush mt-16">
        <div className="card__head pad"><h2 className="card__title">Suspended accounts</h2></div>
        {data.suspendedUsers.length === 0 ? <EmptyState icon={ShieldCheck} title="No suspended accounts" /> : (
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {data.suspendedUsers.map((u) => (
                  <tr key={u._id}>
                    <td><UserCell user={u} /></td>
                    <td className="muted">Suspended {timeAgo(u.updatedAt || u.createdAt)}</td>
                    <td className="cell-actions"><button className="btn btn--secondary btn--sm" onClick={() => reactivate(u)}>Reactivate</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card--flush mt-16">
        <div className="card__head pad"><h2 className="card__title">Failed & blocked attempts</h2></div>
        <EventTable rows={data.failedLogins} empty="No failed attempts recorded." />
      </section>

      <section className="card card--flush mt-16">
        <div className="card__head pad"><h2 className="card__title">Admin actions on accounts</h2></div>
        <EventTable rows={data.adminChanges} empty="No role or access changes yet." />
      </section>

      <section className="card card--flush mt-16">
        <div className="card__head pad"><h2 className="card__title"><KeyRound size={16} /> Password changes</h2></div>
        <EventTable rows={data.passwordEvents} empty="No password changes yet." />
      </section>
    </>
  );
}
