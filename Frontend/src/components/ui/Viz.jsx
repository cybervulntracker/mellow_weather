// A small chart kit drawn with plain SVG + CSS (no chart or animation library).
// Everything here is interactive (hover/tap tooltips, clickable legends) and animates in.
import { useId, useMemo, useState } from "react";
import { PALETTE } from "../../lib/palette";
import { useWidth } from "../../hooks/useMotion";


const niceMax = (max) => {
  if (max <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
};

// Smooth line through points (Catmull-Rom converted to cubic Béziers)
function smoothPath(points) {
  if (points.length < 3) return points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/* ------------------------------------------------------------------ line / area chart */

/**
 * series: [{ key, label, color, values: number[], dashed? }]   labels: string[] (same length as values)
 * The legend toggles series on and off; hovering (or touching) shows a crosshair with every value.
 */
export function LineChart({ labels, series, height = 260, format = (v) => v, area = true, yMin, yMax, every, smooth = true, legend = true, ariaLabel = "Chart" }) {
  const [boxRef, boxWidth] = useWidth();
  const uid = useId().replace(/:/g, "");
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null);
  const W = Math.max(boxWidth, 280), H = height, padL = 40, padR = 14, padT = 16, padB = 30;
  const visible = series.filter((s) => !hidden.has(s.key));
  const all = visible.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v));
  const lo = yMin ?? (all.length ? Math.min(0, ...all) : 0);
  const hiRaw = all.length ? Math.max(...all) : 1;
  const hi = yMax ?? (lo === 0 ? niceMax(hiRaw) : hiRaw + (hiRaw - lo) * 0.1 || 1);
  const n = labels.length;
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(n - 1, 1);
  const y = (v) => padT + (1 - (v - lo) / Math.max(hi - lo, 1e-9)) * (H - padT - padB);
  const step = every || Math.ceil(n / 7);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);
  const sig = visible.map((s) => `${s.key}:${s.values.join(",")}`).join("|");

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.touches?.[0]?.clientX ?? e.clientX) - rect.left) / rect.width;
    const i = Math.round(((px * W - padL) / (W - padL - padR)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }
  const toggle = (key) => setHidden((h) => { const next = new Set(h); if (next.has(key)) next.delete(key); else if (visible.length > 1) next.add(key); return next; });

  return (
    <div className="viz">
      <div className="viz__stage" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} onMouseMove={onMove} onTouchMove={onMove} onTouchStart={onMove} onMouseLeave={() => setHover(null)} className="viz__svg">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="viz__grid" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="chart__label">{format(Math.round(t * 10) / 10)}</text>
            </g>
          ))}
          <g key={sig}>
            {visible.map((s, si) => {
              const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
              if (pts.length < 2) return null;
              const d = smooth ? smoothPath(pts) : pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
              return (
                <g key={s.key} style={{ "--i": si }}>
                  {area && visible.length <= 2 && <path d={`${d} L${pts[pts.length - 1][0]} ${H - padB} L${pts[0][0]} ${H - padB} Z`} fill={`url(#${uid}-${s.key})`} className="viz__area" />}
                  <path d={d} pathLength="1" fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? "5 5" : undefined} className={`viz__line ${s.dashed ? "" : "is-draw"}`} />
                </g>
              );
            })}
          </g>
          {labels.map((l, i) => (i === n - 1 || (i % step === 0 && n - 1 - i >= Math.ceil(step * 0.7))) ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="chart__label">{l}</text>
          ) : null)}
          {hover != null && (
            <g className="viz__cursor">
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} className="viz__crosshair" />
              {visible.map((s) => s.values[hover] != null && <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="5" fill="var(--surface)" stroke={s.color} strokeWidth="2.5" />)}
            </g>
          )}
        </svg>
        {hover != null && (
          <div className="viz__tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <span className="viz__tip-title">{labels[hover]}</span>
            {visible.map((s) => <span key={s.key} className="viz__tip-row"><i style={{ background: s.color }} />{s.label}<b>{s.values[hover] == null ? "—" : format(s.values[hover])}</b></span>)}
          </div>
        )}
      </div>
      {legend && series.length > 1 && (
        <div className="viz__legend" role="group">
          {series.map((s) => (
            <button key={s.key} className={`viz__chip ${hidden.has(s.key) ? "is-off" : ""}`} onClick={() => toggle(s.key)} aria-pressed={!hidden.has(s.key)}>
              <i style={{ background: s.color }} />{s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bars */

/** labels + series [{key,label,color,values}] — grouped by default, `stacked` to stack. */
export function BarChart({ labels, series, height = 220, stacked = false, format = (v) => v, every }) {
  const [boxRef, boxWidth] = useWidth();
  const [hover, setHover] = useState(null);
  const W = Math.max(boxWidth, 240), H = height, padL = 36, padR = 10, padT = 12, padB = 28;
  const n = labels.length;
  const totals = labels.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...series.map((s) => s.values[i] || 0))));
  const hi = niceMax(Math.max(...totals, 1));
  const slot = (W - padL - padR) / n;
  const bw = Math.min(34, slot * 0.62);
  const y = (v) => padT + (1 - v / hi) * (H - padT - padB);
  const step = every || Math.ceil(n / 8);

  return (
    <div className="viz">
      <div className="viz__stage" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="viz__svg" role="img" aria-label="Bar chart" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}><line x1={padL} x2={W - padR} y1={y(hi * f)} y2={y(hi * f)} className="viz__grid" /><text x={padL - 8} y={y(hi * f) + 4} textAnchor="end" className="chart__label">{format(Math.round(hi * f * 10) / 10)}</text></g>
          ))}
          {labels.map((l, i) => {
            const cx = padL + slot * i + slot / 2;
            let acc = 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                <rect x={cx - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
                {series.map((s, si) => {
                  const v = s.values[i] || 0;
                  const w = stacked ? bw : bw / series.length;
                  const bx = stacked ? cx - bw / 2 : cx - bw / 2 + si * w;
                  const top = stacked ? y(acc + v) : y(v);
                  const h = stacked ? y(acc) - y(acc + v) : H - padB - y(v);
                  acc += v;
                  return <rect key={s.key} x={bx} y={top} width={Math.max(w - 1, 2)} height={Math.max(h, v ? 2 : 0)} rx="3" fill={s.color} className={`viz__bar ${hover === i ? "is-hot" : ""}`} style={{ "--i": i, transformOrigin: `${bx}px ${H - padB}px` }} />;
                })}
                {i % step === 0 && <text x={cx} y={H - 8} textAnchor="middle" className="chart__label">{l}</text>}
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <div className="viz__tip" style={{ left: `${((padL + slot * hover + slot / 2) / W) * 100}%` }}>
            <span className="viz__tip-title">{labels[hover]}</span>
            {series.map((s) => <span key={s.key} className="viz__tip-row"><i style={{ background: s.color }} />{s.label}<b>{format(s.values[hover] || 0)}</b></span>)}
          </div>
        )}
      </div>
      {series.length > 1 && <div className="viz__legend">{series.map((s) => <span key={s.key} className="viz__chip is-static"><i style={{ background: s.color }} />{s.label}</span>)}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ donut */

/** slices: [{ label, value, color? }]. Hover (or click) a slice or legend row to focus it. */
export function Donut({ slices, size = 190, thickness = 26, centerLabel = "Total", format = (v) => v }) {
  const [active, setActive] = useState(null);
  const data = slices.filter((s) => s.value > 0).map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length] }));
  const total = data.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const offsets = data.map((_, i) => data.slice(0, i).reduce((a, s) => a + (s.value / (total || 1)) * c, 0));
  const current = active != null ? data[active] : null;

  if (!total) return <p className="muted small">No data yet.</p>;
  return (
    <div className="donut">
      <div className="donut__chart" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Donut chart">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={thickness} />
          {data.map((s, i) => {
            const len = (s.value / total) * c;
            const offset = offsets[i];
            return (
              <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={active === i ? thickness + 6 : thickness}
                strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt"
                className="donut__slice" style={{ "--i": i, opacity: active == null || active === i ? 1 : 0.35 }}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === i ? null : i)} />
            );
          })}
        </svg>
        <div className="donut__center">
          <strong>{current ? format(current.value) : format(total)}</strong>
          <span>{current ? current.label : centerLabel}</span>
          {current && <em>{Math.round((current.value / total) * 100)}%</em>}
        </div>
      </div>
      <ul className="donut__legend">
        {data.map((s, i) => (
          <li key={s.label} className={active === i ? "is-active" : ""} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
            <i style={{ background: s.color }} /><span>{s.label}</span><b>{format(s.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ heatmap */

export function Heatmap({ grid, rows, cols, colEvery = 3, unit = "actions" }) {
  const [hover, setHover] = useState(null);
  const max = useMemo(() => Math.max(...grid.flat(), 1), [grid]);
  return (
    <div className="heat">
      <div className="heat__grid" style={{ "--cols": cols.length }}>
        {grid.map((row, r) => (
          <div className="heat__row" key={r}>
            <span className="heat__rowlabel">{rows[r]}</span>
            {row.map((v, c) => (
              <i key={c} className={`heat__cell ${hover?.r === r && hover?.c === c ? "is-hot" : ""}`} style={{ "--a": v ? 0.14 + (v / max) * 0.86 : 0, "--i": (r + c) % 12 }}
                onMouseEnter={() => setHover({ r, c, v })} onMouseLeave={() => setHover(null)} onClick={() => setHover({ r, c, v })} />
            ))}
          </div>
        ))}
        <div className="heat__axis"><span />{cols.map((c, i) => <span key={i}>{i % colEvery === 0 ? c : ""}</span>)}</div>
      </div>
      <div className="heat__foot">
        <span className="muted small">{hover ? `${rows[hover.r]} · ${cols[hover.c]} — ${hover.v} ${unit}` : "Hover a cell for details"}</span>
        <span className="heat__scale"><small>less</small><i /><small>more</small></span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ gauge, ring, sparkline, compass */

/** Semi-circle gauge. `stops` colours the arc: [[upToValue, color], ...] */
export function Gauge({ value, min = 0, max = 100, label, display, stops, size = 160 }) {
  const uid = useId().replace(/:/g, "");
  const p = Math.min(1, Math.max(0, ((value ?? min) - min) / (max - min)));
  const r = 62, cx = 80, cy = 78, len = Math.PI * r;
  const color = (stops || [[max, "var(--accent)"]]).find(([upTo]) => (value ?? min) <= upTo)?.[1] || "var(--accent)";
  const angle = -90 + p * 180;
  return (
    <div className="gauge" style={{ width: size }}>
      <svg viewBox="0 0 160 96" width="100%" role="img" aria-label={label}>
        <defs><linearGradient id={uid}><stop offset="0%" stopColor={color} stopOpacity=".55" /><stop offset="100%" stopColor={color} /></linearGradient></defs>
        <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--track)" strokeWidth="12" strokeLinecap="round" />
        <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={`url(#${uid})`} strokeWidth="12" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} className="gauge__arc" style={{ "--len": len }} />
        <g className="gauge__needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 10} stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill="var(--text)" />
        </g>
      </svg>
      <div className="gauge__read"><strong>{display ?? value ?? "—"}</strong>{label && <span>{label}</span>}</div>
    </div>
  );
}

export function Ring({ value, max = 100, size = 84, stroke = 9, color = "var(--accent)", children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, (value ?? 0) / max));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring__arc" style={{ "--len": c }} />
      </svg>
      <div className="ring__inner">{children}</div>
    </div>
  );
}

export function Sparkline({ values, color = "var(--accent)", height = 34, width = 110, fill = true }) {
  const uid = useId().replace(/:/g, "");
  const v = values.length > 1 ? values : [0, ...values, 0];
  const lo = Math.min(...v), hi = Math.max(...v);
  const x = (i) => (i * (width - 4)) / (v.length - 1) + 2;
  const y = (val) => height - 4 - ((val - lo) / Math.max(hi - lo, 1e-9)) * (height - 8);
  const pts = v.map((val, i) => [x(i), y(val)]);
  const d = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="spark" aria-hidden="true">
      <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill && <path d={`${d} L${width - 2} ${height} L2 ${height} Z`} fill={`url(#${uid})`} />}
      <path d={d} pathLength="1" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" className="viz__line is-draw" />
    </svg>
  );
}

export function WindCompass({ deg = 0, speed, unit, size = 132 }) {
  return (
    <div className="compass" style={{ width: size }}>
      <svg viewBox="0 0 120 120" width="100%" role="img" aria-label={`Wind from ${Math.round(deg)} degrees`}>
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--track)" strokeWidth="2" />
        {Array.from({ length: 36 }).map((_, i) => <line key={i} x1="60" y1="8" x2="60" y2={i % 9 === 0 ? 16 : 12} stroke="var(--border-strong)" strokeWidth="1.2" transform={`rotate(${i * 10} 60 60)`} />)}
        {[["N", 60, 31], ["E", 94, 64], ["S", 60, 97], ["W", 26, 64]].map(([d, tx, ty]) => <text key={d} x={tx} y={ty} textAnchor="middle" className="compass__dir">{d}</text>)}
        <g className="compass__arrow" style={{ transform: `rotate(${deg + 180}deg)`, transformOrigin: "60px 60px" }}>
          <path d="M60 24 L69 62 L60 55 L51 62 Z" fill="var(--accent)" />
          <circle cx="60" cy="60" r="3" fill="var(--surface)" />
        </g>
      </svg>
      <div className="compass__read"><strong>{speed}</strong><span>{unit}</span></div>
    </div>
  );
}
