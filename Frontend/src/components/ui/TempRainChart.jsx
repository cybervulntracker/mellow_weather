import { useState } from "react";
import { toTemp } from "../../lib/units";

/** Daily highs and lows as lines, rainfall as bars. days = [{ date, high, low, rain }] (°C and mm) */
export default function TempRainChart({ days, unit, formatDay, labels }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 240, padX = 30, padT = 20, padB = 30, rainH = 46;
  const highs = days.map((d) => toTemp(d.high, unit));
  const lows = days.map((d) => toTemp(d.low, unit));
  const min = Math.min(...lows) - 2, max = Math.max(...highs) + 2;
  const plotBottom = H - padB - rainH;
  const x = (i) => padX + (i * (W - padX * 2)) / Math.max(days.length - 1, 1);
  const y = (v) => padT + (1 - (v - min) / Math.max(max - min, 1)) * (plotBottom - padT);
  const line = (values) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const maxRain = Math.max(...days.map((d) => d.rain), 1);
  const every = Math.ceil(days.length / 7);
  const barW = Math.max(3, ((W - padX * 2) / days.length) * 0.55);

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(days.length - 1, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * (days.length - 1)))));
  }
  const active = hover != null ? days[hover] : null;

  return (
    <div className="tempchart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="tempchart" role="img" aria-label={labels.title} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => <line key={f} x1={padX} x2={W - padX} y1={padT + f * (plotBottom - padT)} y2={padT + f * (plotBottom - padT)} className="tc-grid" />)}
        {days.map((d, i) => (
          <rect key={d.date} x={x(i) - barW / 2} width={barW} y={H - padB - (d.rain / maxRain) * (rainH - 6)} height={Math.max(d.rain > 0 ? 2 : 0, (d.rain / maxRain) * (rainH - 6))} rx="2" className="tc-rain" />
        ))}
        <path d={line(highs)} className="tc-line tc-high" />
        <path d={line(lows)} className="tc-line tc-low" />
        {days.map((d, i) => (i % every === 0 || i === days.length - 1) && (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} className="chart__label">{formatDay(d.date)}</text>
        ))}
        {active && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} className="tc-cursor" />
            <circle cx={x(hover)} cy={y(highs[hover])} r="4" className="tc-dot tc-dot--high" />
            <circle cx={x(hover)} cy={y(lows[hover])} r="4" className="tc-dot tc-dot--low" />
          </g>
        )}
      </svg>
      {active && (
        <div className="chart__tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{highs[hover]}° / {lows[hover]}°</strong>
          <span>{formatDay(active.date)} · {active.rain} mm</span>
        </div>
      )}
      <div className="legend">
        <span><i className="swatch swatch--high" /> {labels.high}</span>
        <span><i className="swatch swatch--low" /> {labels.low}</span>
        <span><i className="swatch swatch--rain" /> {labels.rain}</span>
      </div>
    </div>
  );
}
