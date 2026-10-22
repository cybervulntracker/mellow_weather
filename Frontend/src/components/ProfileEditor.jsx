import { useEffect, useRef, useState } from "react";
import { Camera, Check, Clock, KeyRound, Loader2, MousePointerClick, Trash2, LogIn } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { fileToAvatarDataUrl } from "../lib/image";
import { actionMeta } from "../lib/actions";
import { formatDate, formatDuration, formatNumber, timeAgo } from "../lib/format";
import { usePrefs } from "../context/PrefsContext";
import Avatar from "./ui/Avatar";
import { useConfirm, useToast } from "./ui/Feedback";

/** Profile page body, shared by the weather site and the admin panel. */
export default function ProfileEditor() {
  const { user, setUser } = useAuth();
  const { t } = usePrefs();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);

  const [name, setName] = useState(user.username);
  const [bio, setBio] = useState(user.bio || "");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([api("/users/me"), api("/users/me/activity?limit=12")])
      .then(([me, logs]) => {
        if (!alive) return;
        setStats(me.stats);
        setActivity(logs);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dirty = name.trim() !== user.username || bio.trim() !== (user.bio || "");

  async function saveDetails(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api("/users/me", { method: "PATCH", body: { username: name, bio } });
      setUser(data.user);
      toast.success(t("profile.updated"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const image = await fileToAvatarDataUrl(file);
      const data = await api("/users/me/avatar", { method: "PUT", body: { image } });
      setUser(data.user);
      toast.success(t("profile.photoUpdated"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    const ok = await confirm({ title: t("profile.removeTitle"), message: t("profile.removeMessage"), confirmLabel: t("common.remove"), danger: true });
    if (!ok) return;
    setPhotoBusy(true);
    try {
      const data = await api("/users/me/avatar", { method: "DELETE" });
      setUser(data.user);
      toast.success(t("profile.photoRemoved"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    if (passwords.next.length < 8) return setPwError(t("auth.passwordHint"));
    if (passwords.next !== passwords.confirm) return setPwError(t("auth.reset.mismatch"));
    setPwBusy(true);
    try {
      await api("/users/me/password", { method: "PUT", body: { currentPassword: passwords.current, newPassword: passwords.next } });
      setUser((u) => ({ ...u, passwordSet: true }));
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success(t("profile.passwordChanged"));
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="profile">
      <div className="profile__main">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">{t("profile.photo")}</h2>
          </div>
          <div className="photo-row">
            <div className="photo-row__avatar">
              <Avatar user={user} size={88} />
              {photoBusy && <span className="photo-row__busy"><Loader2 size={22} className="spin" /></span>}
            </div>
            <div>
              <div className="btn-row">
                <button className="btn btn--secondary" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                  <Camera size={16} /> {user.avatarUrl ? t("profile.change") : t("profile.upload")}
                </button>
                {user.avatarUrl && (
                  <button className="btn btn--ghost btn--danger-text" onClick={removePhoto} disabled={photoBusy}>
                    <Trash2 size={16} /> {t("common.remove")}
                  </button>
                )}
              </div>
              <p className="muted small mt-8">{t("profile.photoHint")}</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPickPhoto} />
            </div>
          </div>
        </section>

        <form className="card" onSubmit={saveDetails}>
          <div className="card__head">
            <h2 className="card__title">{t("profile.details")}</h2>
          </div>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">{t("auth.fullName")}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            </label>
            <label className="field">
              <span className="field__label">{t("auth.email")}</span>
              <input className="input" value={user.email} disabled />
            </label>
            <label className="field field--full">
              <span className="field__label">{t("profile.bio")} <span className="muted">· {bio.length}/240</span></span>
              <textarea className="input textarea" rows={3} value={bio} maxLength={240} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bioPlaceholder")} />
            </label>
          </div>
          <div className="card__foot">
            <button className="btn btn--primary" disabled={!dirty || saving || !name.trim()}>
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />} {t("profile.save")}
            </button>
          </div>
        </form>

        <form className="card" onSubmit={changePassword}>
          <div className="card__head">
            <h2 className="card__title">{t("profile.password")}</h2>
          </div>
          <div className="form-grid">
            {user.passwordSet && (
              <label className="field field--full">
                <span className="field__label">{t("profile.currentPassword")}</span>
                <input className="input" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} required />
              </label>
            )}
            <label className="field">
              <span className="field__label">{t("auth.reset.new")}</span>
              <input className="input" type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} required />
            </label>
            <label className="field">
              <span className="field__label">{t("auth.reset.confirm")}</span>
              <input className="input" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required />
            </label>
          </div>
          {pwError && <p className="form-error">{pwError}</p>}
          <div className="card__foot">
            <button className="btn btn--secondary" disabled={pwBusy || (user.passwordSet && !passwords.current) || !passwords.next}>
              {pwBusy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />} {t("profile.updatePassword")}
            </button>
          </div>
        </form>
      </div>

      <aside className="profile__aside">
        <section className="card">
          <div className="profile-id">
            <Avatar user={user} size={56} />
            <div className="profile-id__text">
              <strong>{user.username}</strong>
              <span className="muted small">{user.email}</span>
            </div>
          </div>
          <div className="chips mt-12">
            <span className={`badge ${user.role === "admin" ? "badge--accent" : "badge--neutral"}`}>{user.role === "admin" ? t("profile.role.admin") : t("profile.role.member")}</span>
            <span className="muted small">{t("profile.joined", { date: formatDate(user.createdAt) })}</span>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2 className="card__title">{t("profile.usage")}</h2></div>
          <div className="mini-stats">
            <div className="mini-stat"><Clock size={16} /><strong>{formatDuration(stats?.totalActiveSeconds)}</strong><span>{t("profile.activeTime")}</span></div>
            <div className="mini-stat"><MousePointerClick size={16} /><strong>{formatNumber(stats?.totalActions)}</strong><span>{t("profile.actions")}</span></div>
            <div className="mini-stat"><LogIn size={16} /><strong>{formatNumber(stats?.totalSessions)}</strong><span>{t("profile.sessions")}</span></div>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2 className="card__title">{t("profile.recentActivity")}</h2></div>
          {activity.length === 0 ? (
            <p className="muted small">{t("profile.noActivity")}</p>
          ) : (
            <ul className="feed">
              {activity.map((log) => {
                const meta = actionMeta(log.action);
                const Icon = meta.icon;
                return (
                  <li key={log._id} className="feed__item">
                    <span className={`feed__icon tone-${meta.tone}`}><Icon size={14} /></span>
                    <div className="feed__body">
                      <span className="feed__text">{log.description}</span>
                      <span className="feed__time">{timeAgo(log.occurredAt || log.createdAt, t)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
