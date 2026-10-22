import { Link, Outlet, useLocation } from "react-router-dom";
import { ExternalLink, Menu } from "lucide-react";
import { AdminProvider, useAdmin } from "../../context/AdminContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import ThemeToggle from "../../components/ThemeToggle";
import VerifyBanner from "../../components/VerifyBanner";
import { PrefsOverride } from "../../context/PrefsContext";
import { NAV } from "../../components/admin/nav";

function titleFor(pathname) {
  const all = NAV.flatMap((g) => g.items);
  const match = [...all].reverse().find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  return match?.label || "Admin";
}

function Shell() {
  const { collapsed, setMobileOpen } = useAdmin();
  const { pathname } = useLocation();

  return (
    <div className={`admin ${collapsed ? "is-collapsed" : ""}`}>
      <AdminSidebar />
      <div className="admin__main">
        <header className="topbar">
          <button className="icon-btn topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span className="topbar__title">{titleFor(pathname)}</span>
          <ThemeToggle />
          <Link to="/weather" className="btn btn--secondary btn--sm topbar__site">
            View website <ExternalLink size={14} />
          </Link>
        </header>
        <VerifyBanner />
        <main className="admin__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <PrefsOverride language="en">
      <AdminProvider>
        <Shell />
      </AdminProvider>
    </PrefsOverride>
  );
}
