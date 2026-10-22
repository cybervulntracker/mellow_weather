import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Counter from "../ui/Counter";
import { Sparkline } from "../ui/Viz";

/** A big number that counts up, a trend chip against the previous period and a tiny chart. */
export default function KpiCard({ icon: Icon, label, value, delta, spark, sub, color = "#6366f1", format, live }) {
  const up = delta > 0;
  return (
    <div className="kpi-card" style={{ "--c": color }}>
      <div className="kpi-card__top">
        <span className="kpi-card__icon"><Icon size={18} /></span>
        <span className="kpi-card__label">{label}</span>
        {delta != null && delta !== 0 && <span className={`delta ${up ? "delta--up" : "delta--down"}`}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta)}%</span>}
        {live && <i className="live-dot" />}
      </div>
      <div className="kpi-card__body">
        <strong><Counter value={value} format={format} /></strong>
        {spark?.length > 1 && <Sparkline values={spark} color={color} />}
      </div>
      {sub && <span className="kpi-card__sub">{sub}</span>}
    </div>
  );
}
