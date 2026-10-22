import { Activity, BarChart3, ClipboardList, Inbox, LayoutDashboard, MonitorSmartphone, Search, Server, Settings, ShieldCheck, Star, UserRound, Users } from "lucide-react";

export const NAV = [
  { section: "Overview", items: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { section: "Management", items: [
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/sessions", label: "Sessions", icon: MonitorSmartphone },
    { to: "/admin/support", label: "Support inbox", icon: Inbox, badge: "support" },
  ] },
  { section: "Weather data", items: [
    { to: "/admin/searches", label: "Searches", icon: Search },
    { to: "/admin/favorites", label: "Favourites", icon: Star },
  ] },
  { section: "Monitoring", items: [
    { to: "/admin/activity", label: "Activity log", icon: Activity },
    { to: "/admin/audit", label: "Audit trail", icon: ClipboardList },
    { to: "/admin/security", label: "Security", icon: ShieldCheck },
    { to: "/admin/system", label: "System health", icon: Server },
  ] },
  { section: "System", items: [
    { to: "/admin/settings", label: "Settings", icon: Settings },
    { to: "/admin/profile", label: "My profile", icon: UserRound },
  ] },
];
