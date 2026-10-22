import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import Avatar from "../ui/Avatar";
import { actionMeta } from "../../lib/actions";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="ahead">
      <div>
        <h1 className="ahead__title">{title}</h1>
        {subtitle && <p className="ahead__sub">{subtitle}</p>}
      </div>
      {actions && <div className="ahead__actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, live = false }) {
  return (
    <div className="stat">
      <div className="stat__icon"><Icon size={18} strokeWidth={1.8} /></div>
      <div className="stat__body">
        <span className="stat__label">{label}</span>
        <strong className="stat__value">{value}</strong>
        {sub && <span className="stat__sub">{live && <i className="live-dot" />}{sub}</span>}
      </div>
    </div>
  );
}

export const RoleBadge = ({ role }) => (
  <span className={`badge ${role === "admin" ? "badge--accent" : "badge--neutral"}`}>{role === "admin" ? "Admin" : "User"}</span>
);

export const StatusBadge = ({ status }) => (
  <span className={`badge ${status === "suspended" ? "badge--danger" : "badge--success"}`}>{status === "suspended" ? "Suspended" : "Active"}</span>
);

export function UserCell({ user, size = 34, onClick }) {
  if (!user) {
    return (
      <div className="usercell">
        <Avatar user={{ username: "?" }} size={size} />
        <div className="usercell__text"><strong>Deleted user</strong><span>—</span></div>
      </div>
    );
  }
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`usercell ${onClick ? "usercell--btn" : ""}`} onClick={onClick}>
      <Avatar user={user} size={size} />
      <div className="usercell__text">
        <strong>{user.username}{user.online && <i className="live-dot live-dot--inline" title="Online now" />}</strong>
        <span>{user.email}</span>
      </div>
    </Tag>
  );
}

export function ActionPill({ action }) {
  const meta = actionMeta(action);
  const Icon = meta.icon;
  return (
    <span className={`pill tone-${meta.tone}`}>
      <Icon size={13} /> {meta.label}
    </span>
  );
}

export function OutcomeBadge({ outcome }) {
  return outcome === "failure"
    ? <span className="badge badge--danger">Failed</span>
    : <span className="badge badge--success">OK</span>;
}

/** "⋯" button with a small dropdown. items: [{ label, icon, onClick, danger, hidden }] */
export function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="rowmenu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="More actions" aria-haspopup="menu" aria-expanded={open}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="menu menu--right" role="menu">
          {items.filter((i) => !i.hidden).map((item) => (
            <button key={item.label} role="menuitem" className={`menu__item ${item.danger ? "menu__item--danger" : ""}`} onClick={() => { setOpen(false); item.onClick(); }}>
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="tbl-skel">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  return (
    <div className="banner banner--error" role="alert">
      {message}
      {onRetry && <button className="link-btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}
