/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import useActivityTracker from "../hooks/useActivityTracker";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  // Who is logged in? (asked once when the app opens)
  useEffect(() => {
    let alive = true;
    api("/auth/me")
      .then((me) => alive && setUser(me))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  // Any API call that comes back "not logged in" drops us to the login page
  useEffect(() => {
    const onExpired = (event) => {
      setUser(null);
      if (event.detail?.suspended) setNotice("Your account has been suspended. Please contact an administrator.");
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  useActivityTracker(Boolean(user));

  // Password sign-in. With two-factor on, the answer is { twoFactorRequired: true } and the code comes next.
  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    if (data.twoFactorRequired) return { twoFactorRequired: true };
    setNotice("");
    setUser(data.user);
    return { user: data.user };
  }, []);

  const verifyTwoFactor = useCallback(async (code) => {
    const data = await api("/auth/two-factor", { method: "POST", body: { code } });
    setNotice("");
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const data = await api("/auth/google", { method: "POST", body: { credential } });
    if (data.twoFactorRequired) return { twoFactorRequired: true };
    setNotice("");
    setUser(data.user);
    return { user: data.user };
  }, []);

  const register = useCallback(async (username, email, password) => {
    await api("/auth/register", { method: "POST", body: { username, email, password } });
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* already logged out */ }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, notice, login, verifyTwoFactor, loginWithGoogle, register, logout }),
    [user, loading, notice, login, verifyTwoFactor, loginWithGoogle, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
