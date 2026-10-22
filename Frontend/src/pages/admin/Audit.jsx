import { useState } from "react";
import { ClipboardList } from "lucide-react";
import useApi from "../../hooks/useApi";
import { formatDateTime } from "../../lib/format";
import { actionMeta } from "../../lib/actions";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import { BarList } from "../../components/ui/Charts";
import { ErrorNote, PageHeader, UserCell } from "../../components/admin/bits";

// Read-only history of everything admins have changed. Nobody can edit or delete these rows from the panel.
export default function Audit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const params = new URLSearchParams({ page, limit: 15 });
  if (action) params.set("action", action);
  const { data, error, reload } = useApi(`/admin/audit?${params}`);

  return (
    <>
      <PageHeader title="Audit trail" subtitle="Every change made by an administrator — who did it, what changed and when. Read-only." />
      <div className="grid-2-1 grid-1-2">
        <section className="card">
          <div className="card__head"><h2 className="card__title">By type</h2></div>
          {data ? <BarList empty="No admin changes yet." items={data.actions.slice(0, 8).map((a) => ({ key: a.action, label: actionMeta(a.action).label, value: a.count, display: a.count }))} /> : <div className="skeleton" style={{ height: 180 }} />}
          {action && <button className="link-btn mt-8" onClick={() => { setAction(""); setPage(1); }}>Clear filter</button>}
          {data && <div className="chips mt-12">{data.actions.slice(0, 8).map((a) => <button key={a.action} className={`viz__chip ${action === a.action.replace("admin.", "") ? "is-on" : ""}`} onClick={() => { setAction(a.action.replace("admin.", "")); setPage(1); }}>{a.action.replace("admin.", "")}</button>)}</div>}
        </section>
        <section className="card card--flush">
          {error && !data && <div className="pad"><ErrorNote message={error} onRetry={reload} /></div>}
          {data && (data.logs.length === 0 ? <EmptyState icon={ClipboardList} title="Nothing recorded yet" text="Admin changes will appear here." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Admin</th><th>What happened</th><th>When</th></tr></thead>
                <tbody>
                  {data.logs.map((l) => (
                    <tr key={l._id}><td><UserCell user={l.actorId} size={28} /></td><td>{l.description}<br /><small className="muted">{l.action}</small></td><td className="muted nowrap">{formatDateTime(l.occurredAt || l.createdAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {data && <div className="pad-x"><Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="entries" /></div>}
        </section>
      </div>
    </>
  );
}
