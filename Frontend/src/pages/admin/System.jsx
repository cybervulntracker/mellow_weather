import { CheckCircle2, Cpu, Database, HardDrive, Timer, XCircle } from "lucide-react";
import useApi from "../../hooks/useApi";
import { formatNumber } from "../../lib/format";
import { BarChart, Gauge, Ring } from "../../components/ui/Viz";
import Counter from "../../components/ui/Counter";
import { ErrorNote, PageHeader } from "../../components/admin/bits";

const FEATURES = [
  ["smtp", "Email (SMTP)", "Needed for verification, reset and digest emails"], ["google", "Google sign-in", "Optional"], ["push", "Browser push", "Needs VAPID keys"],
  ["officialAlerts", "Official weather alerts", "US National Weather Service"], ["tomorrowKey", "Minute-by-minute rain", "Optional Tomorrow.io key"],
  ["geoapifyKey", "Better place search", "Optional Geoapify key"], ["httpsCookies", "Secure cookies (HTTPS)", "On when NODE_ENV=production"],
];

const uptime = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };

export default function System() {
  const { data, error, reload } = useApi("/admin/system", { every: 10000 });
  if (error && !data) return <><PageHeader title="System health" /><ErrorNote message={error} onRetry={reload} /></>;
  if (!data) return <><PageHeader title="System health" subtitle="Checking…" /><div className="kpis">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 160 }} />)}</div></>;

  const heap = Math.round((data.memory.heapUsedMb / Math.max(data.memory.heapTotalMb, 1)) * 100);
  const db = data.database;
  const collections = Object.entries(data.collections);

  return (
    <>
      <PageHeader title="System health" subtitle="Live status of the server, database and optional services. Refreshes every 10 seconds." />
      <div className="kpis">
        <section className="card card--center"><div className="card__head"><h2 className="card__title"><Database size={16} /> Database</h2></div>
          <Ring value={db.state === "connected" ? 100 : 0} color={db.state === "connected" ? "#10b981" : "#ef4444"} size={110}><span>{db.state === "connected" ? "OK" : "Down"}</span></Ring>
          <p className="muted small mt-8">{db.state} · {db.pingMs} ms</p></section>
        <section className="card card--center"><div className="card__head"><h2 className="card__title"><HardDrive size={16} /> Memory</h2></div>
          <Gauge value={heap} min={0} max={100} size={170} display={`${data.memory.heapUsedMb} MB`} label={`of ${data.memory.heapTotalMb} MB heap`} stops={[[70, "#22c55e"], [90, "#eab308"], [100, "#ef4444"]]} />
          <p className="muted small">RSS {data.memory.rssMb} MB</p></section>
        <section className="card card--center"><div className="card__head"><h2 className="card__title"><Cpu size={16} /> CPU load</h2></div>
          <Gauge value={Math.min(data.cpu.load1, data.cpu.cores)} min={0} max={data.cpu.cores} size={170} display={data.cpu.load1} label={`${data.cpu.cores} cores`} stops={[[data.cpu.cores * 0.6, "#22c55e"], [data.cpu.cores * 0.9, "#eab308"], [data.cpu.cores, "#ef4444"]]} /></section>
        <section className="card card--center"><div className="card__head"><h2 className="card__title"><Timer size={16} /> Uptime</h2></div>
          <strong className="bignum"><Counter value={data.uptimeSeconds} format={uptime} /></strong>
          <p className="muted small mt-8">Node {data.node} · {data.environment}</p>
          <p className="muted small">Scheduler: {data.scheduler.running ? `running (${data.scheduler.mode})` : data.scheduler.inApp ? "off" : "runs in the separate worker"}</p></section>
      </div>

      <div className="grid-2 mt-16">
        <section className="card">
          <div className="card__head"><h2 className="card__title">Stored records</h2></div>
          <BarChart height={240} every={1} labels={collections.map(([k]) => k.replace(/([A-Z])/g, " $1").toLowerCase().replace("activity logs", "logs").replace("notifications", "notifs").replace("push devices", "push"))} format={formatNumber}
            series={[{ key: "n", label: "Records", color: "#6366f1", values: collections.map(([, v]) => v) }]} />
        </section>
        <section className="card">
          <div className="card__head"><h2 className="card__title">Services</h2></div>
          <ul className="checklist">
            {FEATURES.map(([key, label, hint], i) => (
              <li key={key} style={{ "--i": i }} className={data.features[key] ? "is-on" : ""}>
                {data.features[key] ? <CheckCircle2 size={18} /> : <XCircle size={18} />}<div><strong>{label}</strong><span>{hint}</span></div><em>{data.features[key] ? "On" : "Off"}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
