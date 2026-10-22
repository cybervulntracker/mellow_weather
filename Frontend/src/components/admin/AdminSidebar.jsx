import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { NAV } from "./nav";
import { useAdmin } from "../../context/AdminContext";
import { useAuth } from "../../context/AuthContext";
import useApi from "../../hooks/useApi";
import { LogoMark } from "../ui/Logo";
import Avatar from "../ui/Avatar";

export default function AdminSidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useAdmin();
  const { user, logout } = useAuth();
  const support = useApi("/admin/support?status=open", { every: 60000 }); // unanswered messages show as a badge
  const badges = { support: support.data?.tickets?.length || 0 };

  return (
    <>
      <div className={`scrim ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)} />
      <aside className={`sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-open" : ""}`}>
        <div className="sidebar__brand">
          <LogoMark size={32} />
          {!collapsed && (
            <div className="sidebar__brand-text">
              <strong>MellowWeather</strong>
              <span>Admin console</span>
            </div>
          )}
          <button className="icon-btn sidebar__close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="sidebar__nav" aria-label="Admin">
          {NAV.map((group) => (
            <div className="sidebar__group" key={group.section}>
              {!collapsed ? <span className="sidebar__section">{group.section}</span> : <span className="sidebar__divider" />}
              {group.items.map(({ to, label, icon: Icon, end, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={collapsed ? label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `sidebar__link ${isActive ? "is-active" : ""}`}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  {!collapsed && <span>{label}</span>}
                  {badge && badges[badge] > 0 && <span className="sidebar__badge">{badges[badge]}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__me">
            <Avatar user={user} size={34} />
            {!collapsed && (
              <div className="sidebar__me-text">
                <strong>{user.username}</strong>
                <span>{user.email}</span>
              </div>
            )}
            <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
          <button className="sidebar__collapse" onClick={toggleCollapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight size={17} /> : <><ChevronsLeft size={17} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
