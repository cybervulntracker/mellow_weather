import { useEffect, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { timeAgo } from "../../lib/format";
import { useConfirm, useToast } from "../../components/ui/Feedback";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import { BarList } from "../../components/ui/Charts";
import { Donut } from "../../components/ui/Viz";
import UserDrawer from "../../components/admin/UserDrawer";
import { ErrorNote, PageHeader, TableSkeleton, UserCell } from "../../components/admin/bits";

// Shared by the Searches and Favourites admin pages
export default function PlacesTable({ kind, title, subtitle, icon: Icon, topTitle }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const isSearch = kind === "searches";

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page, limit: 15 });
  if (debouncedQ) params.set("q", debouncedQ);
  const { data, loading, error, reload } = useApi(`/admin/${kind}?${params}`, { every: 20000 });

  async function remove(item) {
    const ok = await confirm({
      title: "Delete this entry?",
      message: `${item.city}, ${item.country} will be removed from ${item.userId?.username || "the user"}'s ${isSearch ? "search history" : "favourites"}.`,
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/${kind}/${item._id}`, { method: "DELETE" });
      toast.success("Entry deleted");
      reload();
    } catch (err) { toast.error(err.message); }
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      {data && data.top.length > 0 && (
        <div className="grid-2 mb-16">
          <section className="card">
            <div className="card__head"><h2 className="card__title">Share by country</h2></div>
            <Donut size={170} centerLabel={isSearch ? "searches" : "saves"} slices={Object.entries(data.top.reduce((acc, c) => ({ ...acc, [c.country || "Unknown"]: (acc[c.country || "Unknown"] || 0) + c.count }), {})).map(([label, value]) => ({ label, value }))} />
          </section>
          <section className="card">
            <div className="card__head"><h2 className="card__title">Top 5 at a glance</h2></div>
            <ol className="podium">
              {data.top.slice(0, 5).map((c, i) => <li key={`${c.city}${c.country}`} style={{ "--i": i }}><span className="rank">{i + 1}</span><strong>{c.city}</strong><small>{c.country}</small><b>{c.count}{isSearch ? "×" : ""}</b></li>)}
            </ol>
          </section>
        </div>
      )}
      <div className="grid-2-1 grid-1-2">
        <section className="card">
          <div className="card__head"><h2 className="card__title">{topTitle}</h2></div>
          {data ? (
            <BarList
              empty="Nothing yet."
              items={data.top.map((c) => ({ key: `${c.city}${c.country}`, label: c.city, sub: isSearch ? `${c.country} · ${c.users} user${c.users === 1 ? "" : "s"}` : c.country, value: c.count, display: isSearch ? `${c.count}×` : c.count }))}
            />
          ) : <div className="skeleton" style={{ height: 200 }} />}
        </section>

        <section className="card card--flush">
          <div className="toolbar">
            <div className="search-field">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by city" aria-label="Search by city" />
              {q && <button onClick={() => setQ("")} aria-label="Clear search"><X size={14} /></button>}
            </div>
          </div>

          {error && !data && <div className="pad"><ErrorNote message={error} onRetry={reload} /></div>}
          {loading && !data && <div className="pad"><TableSkeleton /></div>}

          {data && (data.items.length === 0 ? (
            <EmptyState icon={Icon} title="Nothing here yet" text={debouncedQ ? "No city matches your search." : "Entries appear as people use the site."} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Place</th><th>User</th>{isSearch && <th className="num">Times</th>}<th>{isSearch ? "Last searched" : "Saved"}</th><th /></tr></thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item._id}>
                      <td><strong>{item.city}</strong><span className="muted small block">{item.country}</span></td>
                      <td><UserCell user={item.userId} size={28} onClick={item.userId ? () => setOpenId(item.userId._id) : undefined} /></td>
                      {isSearch && <td className="num">{item.count || 1}</td>}
                      <td className="muted nowrap">{timeAgo(isSearch ? item.updatedAt : item.createdAt)}</td>
                      <td className="cell-actions">
                        <button className="icon-btn icon-btn--danger" onClick={() => remove(item)} aria-label="Delete entry"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {data && <div className="pad-x"><Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="entries" /></div>}
        </section>
      </div>
      {openId && <UserDrawer userId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
