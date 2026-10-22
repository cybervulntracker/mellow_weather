import { useState } from "react";
import { formatShortDay } from "../../lib/format";

/** Area chart for a daily series. data = [{ date: "YYYY-MM-DD", value }] */
export function AreaChart({ data, format = (v) => v, height = 220 }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = height, padL = 8, padR = 8, padT = 16, padB = 28;
  const max = Math.max(...data.map((d) => d.value), 1);
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(data.length - 1, 1);
  const y = (v) => padT + (1 - v / niceMax) * (H - padT - padB);

  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(data.length / 7);

  function onMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setHover(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  }

  const active = hover != null ? data[hover] : null;

  return (
    <div className="chart" style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Chart" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(niceMax * t)} y2={y(niceMax * t)} stroke="var(--border)" strokeDasharray={t === 0 ? "" : "3 4"} />
          </g>
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="chart__label">
              {formatShortDay(d.date)}
            </text>
          ) : null
        )}
        {active && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--border-strong)" />
            <circle cx={x(hover)} cy={y(active.value)} r="4.5" fill="#fff" stroke="var(--accent)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {active && (
        <div className="chart__tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{format(active.value)}</strong>
          <span>{formatShortDay(active.date)}</span>
        </div>
      )}
    </div>
  );
}

/** Small column chart (e.g. sign-ups per day) */
export function ColumnChart({ data, height = 140 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const labelEvery = Math.ceil(data.length / 7);
  return (
    <div className="columns" style={{ height }}>
      {data.map((d, i) => (
        <div className="columns__col" key={d.date} title={`${formatShortDay(d.date)}: ${d.value}`}>
          <div className="columns__bar-wrap">
            <div className="columns__bar" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 2 }} />
          </div>
          <span className="columns__label">{i % labelEvery === 0 ? formatShortDay(d.date) : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** Ranked list with proportional bars */
export function BarList({ items, empty = "Nothing to show yet." }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <p className="muted small">{empty}</p>;
  return (
    <ul className="barlist">
      {items.map((item) => (
        <li key={item.key || item.label}>
          <div className="barlist__row">
            <span className="barlist__label">{item.label}</span>
            <span className="barlist__value">{item.display ?? item.value}</span>
          </div>
          <div className="barlist__track">
            <div className="barlist__fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          {item.sub && <span className="barlist__sub">{item.sub}</span>}
        </li>
      ))}
    </ul>
  );
}
