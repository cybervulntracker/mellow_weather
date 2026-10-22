import { useEffect, useState } from "react";
import { Puffy } from "../pages/auth/Mascot";

// Full-screen "we'll be right back" page, shown when the server says it is in maintenance mode.
export default function MaintenanceGate() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const on = (e) => setMessage(e.detail?.message || "We'll be back shortly.");
    window.addEventListener("app:maintenance", on);
    return () => window.removeEventListener("app:maintenance", on);
  }, []);
  if (!message) return null;
  return (
    <div className="maint" role="alert">
      <div className="maint__card">
        <Puffy mood="sad" size={150} />
        <h1>Back in a moment</h1>
        <p>{message}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  );
}
