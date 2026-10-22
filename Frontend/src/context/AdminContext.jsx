/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";

const AdminContext = createContext(null);
const KEY = "mellow:admin-sidebar-collapsed";

export function AdminProvider({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => setCollapsed((prev) => {
    const next = !prev;
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });

  return (
    <AdminContext.Provider value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
