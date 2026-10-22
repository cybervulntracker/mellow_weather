export const homeFor = (user) => (user?.role === "admin" ? "/admin" : "/weather");
