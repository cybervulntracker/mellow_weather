import { useState } from "react";
import { Laptop, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";
import useApi from "../../hooks/useApi";
import { formatDateTime, formatDuration, timeAgo } from "../../lib/format";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import UserDrawer from "../../components/admin/UserDrawer";
import { ErrorNote, PageHeader, TableSkeleton, UserCell } from "../../components/admin/bits";

const DEVICE_ICON = { Mobile: Smartphone, Tablet, Desktop: Laptop };
const STATUS = {
  live: { label: "Live", cls: "badge--live" },
  ended: { label: "Signed out", cls: "badge--neutral" },
  expired: { label: "Timed out", cls: "badge--neutral" },
};

export default function Sessions() {
  const [view, setView] = useState("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const params = new URLSearchParams({ page, limit: 15 });
  if (view === "live") params.set("status", "live");
  const { data, loading, error, reload } = useApi(`/admin/sessions?${params}`, { every: 10000 });

  return (
    <>
      <PageHeader title="Sessions" subtitle="Every login, how long people were really active, and from which device." />

      <section className="card card--flush">
        <div className="toolbar">
          <div className="segmented">
            <button className={`segmented__btn ${view === "all" ? "is-active" : ""}`} onClick={() => { setView("all"); setPage(1); }}>All sessions</button>
            <button className={`segmented__btn ${view === "live" ? "is-active" : ""}`} onClick={() => { setView("live"); setPage(1); }}>
              Live now{data ? ` (${data.liveCount})` : ""}
            </button>
          </div>
          <span className="muted small toolbar__note">Refreshes every 10 seconds</span>
        </div>

        {error && !data && <div className="pad"><ErrorNote message={error} onRetry={reload} /></div>}
        {loading && !data && <div className="pad"><TableSkeleton /></div>}

        {data && (data.sessions.length === 0 ? (
          <EmptyState icon={MonitorSmartphone} title={view === "live" ? "Nobody is online right now" : "No sessions yet"} text="Sessions appear as soon as someone signs in." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>User</th><th>Started</th><th className="num">Active time</th><th>Last seen</th><th>Device</th><th>Viewing</th><th>Status</th></tr></thead>
              <tbody>
                {data.sessions.map((s) => {
                  const Device = DEVICE_ICON[s.device] || MonitorSmartphone;
                  const st = STATUS[s.status];
                  return (
                    <tr key={s._id}>
                      <td><UserCell user={s.userId} size={30} onClick={s.userId ? () => setOpenId(s.userId._id) : undefined} /></td>
                      <td className="nowrap">{formatDateTime(s.startedAt)}</td>
                      <td className="num">{formatDuration(s.activeSeconds)}</td>
                      <td className="muted nowrap">{timeAgo(s.lastSeenAt)}</td>
                      <td className="nowrap"><span className="device"><Device size={15} /> {s.browser} · {s.os}</span><span className="muted small block">{s.ip || "—"}</span></td>
                      <td className="muted mono">{s.status === "live" ? (s.currentPage || "—") : "—"}</td>
                      <td><span className={`badge ${st.cls}`}>{s.status === "live" && <i className="live-dot" />}{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {data && <div className="pad-x"><Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="sessions" /></div>}
      </section>

      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
