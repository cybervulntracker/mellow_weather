import { useState } from "react";
import { Activity, Clock, MousePointerClick, UserPlus, Users } from "lucide-react";
import useApi from "../../hooks/useApi";
import { formatNumber, formatShortDay } from "../../lib/format";
import { BarChart, Donut, Gauge, Heatmap, LineChart } from "../../components/ui/Viz";
import { BarList } from "../../components/ui/Charts";
import Reveal from "../../components/ui/Reveal";
import { ErrorNote, PageHeader } from "../../components/admin/bits";
import KpiCard from "../../components/admin/KpiCard";

const RANGES = [7, 30, 90];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}h`);
const METRICS = [
  ["activeUsers", "Active users", "#ec4899"], ["actions", "Actions", "#6366f1"], ["activeMinutes", "Active minutes", "#06b6d4"], ["signups", "Sign-ups", "#f59e0b"],
];

function Cohorts({ data }) {
  if (!data) return <div className="skeleton" style={{ height: 200 }} />;
  const max = data.weeks;
  return (
    <div className="cohort">
      <div className="cohort__row cohort__row--head"><span>Joined week of</span><span>People</span>{Array.from({ length: max }, (_, i) => <span key={i}>Wk {i}</span>)}</div>
      {data.cohorts.map((c) => (
        <div className="cohort__row" key={c.label}>
          <span>{formatShortDay(c.label)}</span><span>{c.size}</span>
          {Array.from({ length: max }, (_, i) => {
            const v = c.retention[i];
            return <span key={i} className={`cohort__cell ${v == null ? "is-empty" : ""}`} style={{ "--a": v == null ? 0 : 0.12 + (v / 100) * 0.88 }} title={v == null ? "" : `${v}% came back`}>{v == null ? "" : `${v}%`}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [shown, setShown] = useState(["activeUsers", "actions"]);
  const { data, error, reload } = useApi(`/admin/analytics?days=${days}`);
  const retention = useApi("/admin/retention");

  if (error && !data) return <><PageHeader title="Analytics" /><ErrorNote message={error} onRetry={reload} /></>;

  const labels = data?.series.map((d) => formatShortDay(d.date)) || [];
  const toggle = (key) => setShown((cur) => (cur.includes(key) ? (cur.length > 1 ? cur.filter((k) => k !== key) : cur) : [...cur, key]));

  return (
    <>
      <PageHeader title="Analytics" subtitle="Dig into how people use the app. Hover charts for details, click legends to switch lines on and off."
        actions={<div className="segmented" role="group" aria-label="Date range">{RANGES.map((r) => <button key={r} className={`segmented__btn ${days === r ? "is-active" : ""}`} onClick={() => setDays(r)}>{r} days</button>)}</div>} />

      {!data ? (
        <><div className="kpis">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div><div className="skeleton mt-16" style={{ height: 340 }} /></>
      ) : (
        <>
          <div className="kpis">
            <KpiCard icon={Users} label="Active user-days" value={data.totals.activeUserDays} delta={data.deltas.activeUserDays} color="#ec4899" spark={data.series.map((d) => d.activeUsers)} sub={`vs the previous ${days} days`} />
            <KpiCard icon={MousePointerClick} label="Actions" value={data.totals.actions} delta={data.deltas.actions} color="#6366f1" spark={data.series.map((d) => d.actions)} sub={`${formatNumber(Math.round(data.totals.actions / days))} per day`} />
            <KpiCard icon={Clock} label="Active minutes" value={data.totals.activeMinutes} delta={data.deltas.activeMinutes} color="#06b6d4" spark={data.series.map((d) => d.activeMinutes)} sub="Time spent in the app" />
            <KpiCard icon={UserPlus} label="New sign-ups" value={data.totals.signups} delta={data.deltas.signups} color="#f59e0b" spark={data.series.map((d) => d.signups)} sub="New accounts" />
          </div>

          <section className="card mt-16">
            <div className="card__head">
              <h2 className="card__title"><Activity size={16} /> Trends</h2>
              <div className="viz__legend viz__legend--inline">
                {METRICS.map(([key, label, color]) => <button key={key} className={`viz__chip ${shown.includes(key) ? "" : "is-off"}`} onClick={() => toggle(key)}><i style={{ background: color }} />{label}</button>)}
              </div>
            </div>
            <LineChart labels={labels} height={320} legend={false} format={formatNumber}
              series={METRICS.filter(([key]) => shown.includes(key)).map(([key, label, color]) => ({ key, label, color, values: data.series.map((d) => d[key]) }))} />
          </section>

          <Reveal className="grid-2 mt-16">
            <section className="card">
              <div className="card__head"><h2 className="card__title">When people use the app</h2><span className="muted small">UTC · last {days} days</span></div>
              <Heatmap grid={data.heatmap} rows={DAYS} cols={HOURS} colEvery={3} />
            </section>
            <section className="card">
              <div className="card__head"><h2 className="card__title">Actions by area</h2></div>
              <BarChart height={250} stacked labels={data.actionGroups.slice(0, 8).map((g) => g.group[0].toUpperCase() + g.group.slice(1))} every={1}
                series={[{ key: "ok", label: "Succeeded", color: "#6366f1", values: data.actionGroups.slice(0, 8).map((g) => g.count - g.failures) }, { key: "bad", label: "Failed", color: "#ef4444", values: data.actionGroups.slice(0, 8).map((g) => g.failures) }]} />
            </section>
          </Reveal>

          <Reveal className="grid-3 mt-16">
            <section className="card"><div className="card__head"><h2 className="card__title">Devices</h2></div><Donut size={150} thickness={22} centerLabel="sessions" slices={data.devices.map((d) => ({ label: d.label, value: d.count }))} /></section>
            <section className="card"><div className="card__head"><h2 className="card__title">Browsers</h2></div><Donut size={150} thickness={22} centerLabel="sessions" slices={data.browsers.map((d) => ({ label: d.label, value: d.count }))} /></section>
            <section className="card"><div className="card__head"><h2 className="card__title">Operating systems</h2></div><Donut size={150} thickness={22} centerLabel="sessions" slices={data.systems.map((d) => ({ label: d.label, value: d.count }))} /></section>
          </Reveal>

          <Reveal className="grid-3 mt-16">
            <section className="card"><div className="card__head"><h2 className="card__title">Session length</h2></div><BarChart height={200} every={1} labels={data.sessionLengths.map((s) => s.label)} series={[{ key: "n", label: "Sessions", color: "#8b5cf6", values: data.sessionLengths.map((s) => s.count) }]} /></section>
            <section className="card"><div className="card__head"><h2 className="card__title">Most searched</h2></div><BarList empty="No searches in this period." items={data.topCities.map((c) => ({ key: `${c.city}${c.country}`, label: c.city, sub: c.country, value: c.count, display: `${c.count}×` }))} /></section>
            <section className="card card--center"><div className="card__head"><h2 className="card__title">Failure rate</h2></div><Gauge value={data.failureRate} min={0} max={20} size={190} display={`${data.failureRate}%`} label="of actions" stops={[[2, "#22c55e"], [6, "#eab308"], [20, "#ef4444"]]} /></section>
          </Reveal>

          <Reveal className="grid-2 mt-16">
            <section className="card"><div className="card__head"><h2 className="card__title">Account status</h2></div>
              <Donut size={150} thickness={22} centerLabel="users" slices={[{ label: "Active", value: data.userStatus.active || 0, color: "#10b981" }, { label: "Suspended", value: data.userStatus.suspended || 0, color: "#ef4444" }]} /></section>
            <section className="card"><div className="card__head"><h2 className="card__title">Roles</h2></div>
              <Donut size={150} thickness={22} centerLabel="users" slices={[{ label: "Users", value: data.userRoles.user || 0, color: "#6366f1" }, { label: "Admins", value: data.userRoles.admin || 0, color: "#f59e0b" }]} /></section>
          </Reveal>

          <Reveal>
            <section className="card mt-16">
              <div className="card__head"><h2 className="card__title">Retention by sign-up week</h2><span className="muted small">Share of each group who came back</span></div>
              <Cohorts data={retention.data} />
            </section>
          </Reveal>
        </>
      )}
    </>
  );
}
