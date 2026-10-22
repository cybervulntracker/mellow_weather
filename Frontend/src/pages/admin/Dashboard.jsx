import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BarChart3, Clock, Inbox, MousePointerClick, Search, Server, ShieldCheck, Star, UserPlus, Users } from "lucide-react";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { actionMeta } from "../../lib/actions";
import { formatNumber, formatShortDay, timeAgo } from "../../lib/format";
import { BarList } from "../../components/ui/Charts";
import { Donut, Gauge, LineChart } from "../../components/ui/Viz";
import { PALETTE } from "../../lib/palette";
import Reveal from "../../components/ui/Reveal";
import { ErrorNote, PageHeader } from "../../components/admin/bits";
import KpiCard from "../../components/admin/KpiCard";
import Avatar from "../../components/ui/Avatar";

const RANGES = [7, 14, 30, 60];
const SERIES = {
  actions: { label: "Actions", color: "#6366f1" },
  minutes: { label: "Active minutes", color: "#06b6d4" },
  signups: { label: "Sign-ups", color: "#f59e0b" },
  users: { label: "Active users", color: "#ec4899" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(14);
  const [shown, setShown] = useState(["actions", "minutes"]);
  const stats = useApi(`/admin/stats?days=${days}`, { every: 30000 });
  const analytics = useApi(`/admin/analytics?days=${days}`, { every: 60000 });
  const support = useApi("/admin/support?status=open", { every: 60000 });

  const data = stats.data;
  const a = analytics.data;
  if (stats.error && !data) return <><PageHeader title="Dashboard" /><ErrorNote message={stats.error} onRetry={stats.reload} /></>;
  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Loading the latest numbers…" />
        <div className="stats">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div>
        <div className="skeleton mt-16" style={{ height: 340 }} />
      </>
    );
  }

  const t = data.totals;
  const labels = data.usageByDay.map((d) => formatShortDay(d.date));
  const series = shown.map((key) => ({
    key, label: SERIES[key].label, color: SERIES[key].color,
    values: key === "actions" ? data.usageByDay.map((d) => d.actions)
      : key === "minutes" ? data.usageByDay.map((d) => Math.round(d.activeSeconds / 60))
      : key === "signups" ? data.signupsByDay.map((d) => d.count)
      : (a?.series || []).map((d) => d.activeUsers),
  })).filter((s) => s.values.length === labels.length);
  const toggle = (key) => setShown((cur) => (cur.includes(key) ? (cur.length > 1 ? cur.filter((k) => k !== key) : cur) : [...cur, key]));

  const spark = (rows, pick) => rows.map(pick);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const openTickets = support.data?.tickets?.length || 0;

  return (
    <>
      <section className="admin-hero">
        <div>
          <p className="eyebrow">{greeting}, {user.username.split(" ")[0]} 👋</p>
          <h1>Here's how MellowWeather is doing</h1>
          <p>{t.activeNow ? `${t.activeNow} ${t.activeNow === 1 ? "person is" : "people are"} using the app right now.` : "Nobody is online at the moment."} {openTickets > 0 && <Link to="/admin/support">{openTickets} unanswered message{openTickets === 1 ? "" : "s"} →</Link>}</p>
        </div>
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((r) => <button key={r} className={`segmented__btn ${days === r ? "is-active" : ""}`} onClick={() => setDays(r)}>{r} days</button>)}
        </div>
      </section>

      <div className="kpis kpis--6">
        <KpiCard icon={Users} label="Total users" value={t.users} sub={`${t.newUsers} new this week`} spark={spark(data.signupsByDay, (d) => d.count)} color="#6366f1" />
        <KpiCard icon={Activity} label="Online now" value={t.activeNow} sub={t.activeNow ? "Active in the last 90s" : "Nobody right now"} color="#10b981" live={t.activeNow > 0} />
        <KpiCard icon={MousePointerClick} label="Actions today" value={t.actionsToday} delta={a?.deltas?.actions} sub={`${formatNumber(t.totalActions)} all time`} spark={spark(data.usageByDay, (d) => d.actions)} color="#ec4899" />
        <KpiCard icon={Clock} label="Active time" value={Math.round(t.totalActiveSeconds / 3600)} format={(n) => `${n} h`} delta={a?.deltas?.activeMinutes} sub="Across all users" spark={spark(data.usageByDay, (d) => d.activeSeconds)} color="#06b6d4" />
        <KpiCard icon={Search} label="Searches" value={t.searches} sub="All time" color="#f59e0b" />
        <KpiCard icon={Star} label="Saved places" value={t.favorites} sub="Across all users" color="#8b5cf6" />
      </div>

      <div className="grid-2-1">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Usage · last {days} days</h2>
            <div className="viz__legend viz__legend--inline">
              {Object.entries(SERIES).map(([key, s]) => (
                <button key={key} className={`viz__chip ${shown.includes(key) ? "" : "is-off"}`} onClick={() => toggle(key)} aria-pressed={shown.includes(key)}><i style={{ background: s.color }} />{s.label}</button>
              ))}
            </div>
          </div>
          <LineChart labels={labels} series={series} height={300} legend={false} format={(v) => formatNumber(v)} />
        </section>

        <section className="card">
          <div className="card__head"><h2 className="card__title">What people do</h2></div>
          <Donut size={180} centerLabel="actions" format={formatNumber} slices={data.actionBreakdown.slice(0, 7).map((x, i) => ({ label: actionMeta(x.action).label, value: x.count, color: PALETTE[i % PALETTE.length] }))} />
        </section>
      </div>

      <Reveal className="grid-3">
        <section className="card">
          <div className="card__head"><h2 className="card__title">Top searched cities</h2><Link to="/admin/searches" className="link-sm">View all</Link></div>
          <BarList empty="No searches yet." items={data.topCities.map((c) => ({ key: `${c.city}${c.country}`, label: c.city, sub: c.country, value: c.count, display: `${c.count}×` }))} />
        </section>
        <section className="card">
          <div className="card__head"><h2 className="card__title">Most saved places</h2><Link to="/admin/favorites" className="link-sm">View all</Link></div>
          <BarList empty="No favourites yet." items={data.topFavorites.map((c) => ({ key: `${c.city}${c.country}`, label: c.city, sub: c.country, value: c.count, display: c.count }))} />
        </section>
        <section className="card card--center">
          <div className="card__head"><h2 className="card__title">Failure rate</h2></div>
          <Gauge value={a?.failureRate ?? 0} min={0} max={20} size={190} display={`${a?.failureRate ?? 0}%`} label="of actions failed" stops={[[2, "#22c55e"], [6, "#eab308"], [20, "#ef4444"]]} />
          <p className="muted small mt-8">Lower is better. Under 2% is healthy.</p>
        </section>
      </Reveal>

      <Reveal className="grid-2-1">
        <section className="card">
          <div className="card__head"><h2 className="card__title">Recent activity</h2><Link to="/admin/activity" className="link-sm">Open log</Link></div>
          {data.recentActivity.length === 0 ? <p className="muted small">No activity yet.</p> : (
            <ul className="feed feed--roomy">
              {data.recentActivity.map((log) => {
                const meta = actionMeta(log.action);
                const Icon = meta.icon;
                return (
                  <li className="feed__item" key={log._id}>
                    <span className={`feed__icon tone-${meta.tone}`}><Icon size={14} /></span>
                    <div className="feed__body">
                      <span className="feed__text"><strong>{log.actorId?.username || "Deleted user"}</strong> · {log.description}</span>
                      <span className="feed__time">{timeAgo(log.occurredAt || log.createdAt)}</span>
                    </div>
                    <Avatar user={log.actorId} size={26} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card__head"><h2 className="card__title">Quick actions</h2></div>
          <div className="tiles tiles--2">
            {[
              [UserPlus, "Add or find users", "/admin/users", "#6366f1"], [BarChart3, "Open analytics", "/admin/analytics", "#06b6d4"],
              [Inbox, "Support inbox", "/admin/support", "#f59e0b"], [ShieldCheck, "Security checks", "/admin/security", "#10b981"],
              [Server, "System health", "/admin/system", "#ec4899"], [Activity, "Activity log", "/admin/activity", "#8b5cf6"],
            ].map(([Icon, label, to, color]) => (
              <Link key={to} to={to} className="tile" style={{ "--c": color }}><span><Icon size={20} /></span>{label}</Link>
            ))}
          </div>
        </section>
      </Reveal>
    </>
  );
}
