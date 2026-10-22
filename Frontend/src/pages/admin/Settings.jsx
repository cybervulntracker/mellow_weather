import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api } from "../../lib/api";
import useApi from "../../hooks/useApi";
import { useToast } from "../../components/ui/Feedback";
import { ErrorNote, PageHeader } from "../../components/admin/bits";

function Form({ initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    siteName: initial.siteName, defaultCity: initial.defaultCity, defaultUnit: initial.defaultUnit,
    allowRegistrations: initial.allowRegistrations, announcement: initial.announcement || "",
    maintenanceMode: Boolean(initial.maintenanceMode), maintenanceMessage: initial.maintenanceMessage || "", weeklyReport: Boolean(initial.weeklyReport),
  });
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const dirty = Object.keys(form).some((k) => form[k] !== (initial[k] ?? (typeof form[k] === "boolean" ? false : "")));

  async function sendReportNow() {
    try { const r = await api("/admin/reports/send", { method: "POST" }); toast.success(r.message); }
    catch (err) { toast.error(err.message); }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api("/admin/settings", { method: "PUT", body: form });
      toast.success("Settings saved");
      onSaved(saved);
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  return (
    <form className="stack" onSubmit={save}>
      <section className="card">
        <div className="card__head"><h2 className="card__title">General</h2></div>
        <div className="form-grid">
          <label className="field"><span className="field__label">Site name</span>
            <input className="input" value={form.siteName} onChange={set("siteName")} maxLength={40} required /></label>
          <label className="field"><span className="field__label">Default city</span>
            <input className="input" value={form.defaultCity} onChange={set("defaultCity")} maxLength={80} required />
            <span className="field__hint">Shown to people who haven't looked up anything yet.</span></label>
          <label className="field"><span className="field__label">Default temperature unit</span>
            <select className="input select" value={form.defaultUnit} onChange={set("defaultUnit")}>
              <option value="C">Celsius (°C)</option><option value="F">Fahrenheit (°F)</option>
            </select>
            <span className="field__hint">Applied to new accounts only.</span></label>
        </div>
      </section>

      <section className="card">
        <div className="card__head"><h2 className="card__title">Access</h2></div>
        <label className="switch-row">
          <div>
            <strong>Allow new registrations</strong>
            <span>When off, the sign-up page tells visitors registrations are closed.</span>
          </div>
          <input type="checkbox" className="switch" checked={form.allowRegistrations} onChange={(e) => setForm({ ...form, allowRegistrations: e.target.checked })} />
        </label>
      </section>

      <section className="card">
        <div className="card__head"><h2 className="card__title">Maintenance mode</h2>{form.maintenanceMode && <span className="badge badge--danger">ON</span>}</div>
        <label className="switch-row">
          <div><strong>Put the site into maintenance mode</strong><span>Visitors and users see a message and can't use the app. Admins keep full access, so you can still sign in and work.</span></div>
          <input type="checkbox" className="switch" checked={form.maintenanceMode} onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })} />
        </label>
        <label className="field mt-12"><span className="field__label">Message shown to people</span>
          <input className="input" value={form.maintenanceMessage} onChange={set("maintenanceMessage")} maxLength={200} placeholder="We're making improvements and will be back shortly." /></label>
      </section>

      <section className="card">
        <div className="card__head"><h2 className="card__title">Weekly report</h2></div>
        <label className="switch-row">
          <div><strong>Email me a weekly summary</strong><span>Every Monday morning (UTC) all active admins with a verified email get new users, activity and open messages.</span></div>
          <input type="checkbox" className="switch" checked={form.weeklyReport} onChange={(e) => setForm({ ...form, weeklyReport: e.target.checked })} />
        </label>
        <div className="btn-row mt-12"><button type="button" className="btn btn--secondary btn--sm" onClick={sendReportNow}>Send the report now</button></div>
      </section>

      <section className="card">
        <div className="card__head"><h2 className="card__title">Announcement banner</h2></div>
        <label className="field">
          <span className="field__label">Message <span className="muted">· {form.announcement.length}/200</span></span>
          <input className="input" value={form.announcement} onChange={set("announcement")} maxLength={200} placeholder="Leave empty to hide the banner" />
          <span className="field__hint">Appears at the top of the weather website for every signed-in user.</span>
        </label>
      </section>

      <div className="btn-row">
        <button className="btn btn--primary" disabled={!dirty || busy}>{busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save settings</button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { data, error, reload } = useApi("/admin/settings");
  const [saved, setSaved] = useState(null);
  const current = saved || data;

  return (
    <>
      <PageHeader title="Settings" subtitle="Site-wide options for MellowWeather." />
      {error && !data && <ErrorNote message={error} onRetry={reload} />}
      {!current && !error && <div className="skeleton" style={{ height: 320 }} />}
      {current && <Form key={current.updatedAt} initial={current} onSaved={setSaved} />}
    </>
  );
}
