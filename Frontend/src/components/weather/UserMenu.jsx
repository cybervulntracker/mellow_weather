import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LayoutDashboard, LogOut, Settings, UserRound } from "lucide-react";
import Avatar from "../ui/Avatar";
import { useAuth } from "../../context/AuthContext";
import { usePrefs } from "../../context/PrefsContext";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu__trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar user={user} size={32} />
        <span className="usermenu__name">{user.username}</span>
        <ChevronDown size={16} className={`usermenu__chevron ${open ? "is-open" : ""}`} />
      </button>

      {open && (
        <div className="menu menu--right" role="menu">
          <div className="menu__header">
            <strong>{user.username}</strong>
            <span>{user.email}</span>
          </div>
          <Link className="menu__item" to="/weather/profile" role="menuitem" onClick={close}><UserRound size={16} /> {t("nav.profile")}</Link>
          <Link className="menu__item" to="/weather/settings" role="menuitem" onClick={close}><Settings size={16} /> {t("nav.settings")}</Link>
          {user.role === "admin" && (
            <Link className="menu__item" to="/admin" role="menuitem" onClick={close}><LayoutDashboard size={16} /> {t("nav.admin")}</Link>
          )}
          <div className="menu__sep" />
          <button className="menu__item" role="menuitem" onClick={logout}><LogOut size={16} /> {t("nav.signout")}</button>
        </div>
      )}
    </div>
  );
}
