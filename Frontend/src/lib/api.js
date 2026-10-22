// One place that knows where the backend lives and how to talk to it.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:7000";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Turns "/api/users/…/avatar?v=1" into a full URL the <img> tag can load.
export const assetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return `${BASE}${path}`;
};

export async function api(path, { method = "GET", body, signal, raw = false, keepalive = false } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      keepalive,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  if (raw) return response;

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* empty body */
  }

  if (!response.ok) {
    const expired = response.status === 401 && !path.startsWith("/auth/login");
    const suspended = response.status === 403 && data?.code === "SUSPENDED";
    if (response.status === 503 && data?.code === "MAINTENANCE") window.dispatchEvent(new CustomEvent("app:maintenance", { detail: { message: data.message } }));
    if (expired || suspended) window.dispatchEvent(new CustomEvent("auth:expired", { detail: { suspended } }));
    throw new ApiError(data?.message || "Something went wrong. Please try again.", response.status, data);
  }

  return data;
}
