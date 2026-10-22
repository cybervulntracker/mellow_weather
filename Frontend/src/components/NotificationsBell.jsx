import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "../lib/api";
import useApi from "../hooks/useApi";
import { usePrefs } from "../context/PrefsContext";
import { lineText, titleText } from "../lib/insights";
import { timeAgo } from "../lib/format";

// Bell with an unread count; the list is refreshed every minute.
export default function NotificationsBell() {
  const { t, fmt } = usePrefs();
  const { data, reload } = useApi("/notifications", { every: 60000 });
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

  const unread = data?.unread || 0;
  async function markRead(id) {
    await api("/notifications/read", { method: "POST", body: id ? { id } : {} }).catch(() => {});
    reload();
  }

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn icon-btn--lg" onClick={() => setOpen((v) => !v)} aria-label={t("nav.notifications")} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="bell__count">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="menu menu--right menu--wide" role="dialog" aria-label={t("nav.notifications")}>
          <div className="menu__header menu__header--row">
            <strong>{t("nav.notifications")}</strong>
            {unread > 0 && <button className="link-btn link-btn--plain" onClick={() => markRead()}>{t("notif.markAll")}</button>}
          </div>
          {!data?.items.length ? (
            <p className="muted small bell__empty">{t("notif.empty")}</p>
          ) : (
            <ul className="bell__list">
              {data.items.map((n) => (
                <li key={n._id}>
                  <button className={`bell__item ${n.readAt ? "" : "is-unread"}`} onClick={() => !n.readAt && markRead(n._id)}>
                    <strong>{titleText(t, n.title)}</strong>
                    {n.lines.map((line, i) => <span key={i}>{lineText(t, fmt, line)}</span>)}
                    <small>{timeAgo(n.createdAt, t)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
