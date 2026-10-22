import { useMemo, useState } from "react";
import { Award, Compass, Crown, Flame, Globe2, Heart, Moon, Sparkles, Sunrise } from "lucide-react";
import useApi from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useWeather } from "../../context/WeatherContext";
import { usePrefs } from "../../context/PrefsContext";
import { actionMeta } from "../../lib/actions";
import { formatDuration } from "../../lib/format";
import { Donut, LineChart, Ring } from "../ui/Viz";
import Counter from "../ui/Counter";
import Reveal from "../ui/Reveal";
import Avatar from "../ui/Avatar";

// The top of the profile page: a hero, your numbers, charts of your own activity and badges you've earned.
export default function ProfileInsights() {
  const { user } = useAuth();
  const { t } = usePrefs();
  const { history, favorites } = useWeather();
  const { data } = useApi("/users/me");
  const stats = data?.stats;
  const [now] = useState(() => Date.now());

  const countries = useMemo(() => new Set(history.map((h) => h.country).filter(Boolean)).size, [history]);
  const searches = history.reduce((a, h) => a + (h.count || 1), 0);
  const joinedDays = Math.max(1, Math.round((now - new Date(user.createdAt || now).getTime()) / 86400000));
  const daily = stats?.dailyUsage || [];
  const activeDays = daily.filter((d) => d.actions > 0).length;

  const badges = [
    { key: "explorer", icon: Compass, goal: 10, value: searches, tone: "indigo" },
    { key: "collector", icon: Heart, goal: 5, value: favorites.length, tone: "pink" },
    { key: "globe", icon: Globe2, goal: 3, value: countries, tone: "cyan" },
    { key: "regular", icon: Flame, goal: 7, value: activeDays, tone: "amber" },
    { key: "veteran", icon: Crown, goal: 30, value: joinedDays, tone: "violet" },
    { key: "nightowl", icon: Moon, goal: 1, value: history.length >= 1 && new Date(now).getHours() >= 22 ? 1 : 0, tone: "slate" },
  ];
  const earned = badges.filter((b) => b.value >= b.goal).length;
  const level = Math.min(10, 1 + Math.floor((searches + favorites.length * 3 + activeDays * 2) / 8));

  const actionSlices = Object.entries(stats?.actionCounts || {})
    .map(([action, value]) => ({ label: actionMeta(action).label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div className="stack">
      <section className="hero-profile">
        <span className="hero-profile__glow" />
        <Avatar user={user} size={92} />
        <div className="hero-profile__text">
          <p className="eyebrow">{t("me.level", { n: level })}</p>
          <h2>{user.username}</h2>
          <p>{user.bio || t("me.noBio")}</p>
          <div className="chips-row">
            <span className="glass-chip"><Sunrise size={14} /> {t("me.memberFor", { n: joinedDays })}</span>
            <span className="glass-chip"><Award size={14} /> {t("me.badges", { n: earned, total: badges.length })}</span>
          </div>
        </div>
        <Ring value={level} max={10} size={96} stroke={10} color="#fff"><span>Lv {level}</span></Ring>
      </section>

      <div className="kpis">
        <div className="kpi"><span className="kpi__icon"><Sparkles size={18} /></span><div><strong><Counter value={searches} /></strong><span>{t("hist.total")}</span></div></div>
        <div className="kpi"><span className="kpi__icon kpi__icon--pink"><Heart size={18} /></span><div><strong><Counter value={favorites.length} /></strong><span>{t("fav.savedCount")}</span></div></div>
        <div className="kpi"><span className="kpi__icon kpi__icon--cyan"><Globe2 size={18} /></span><div><strong><Counter value={countries} /></strong><span>{t("hist.countries")}</span></div></div>
        <div className="kpi"><span className="kpi__icon kpi__icon--amber"><Flame size={18} /></span><div><strong>{formatDuration(stats?.totalActiveSeconds || 0)}</strong><span>{t("profile.activeTime")}</span></div></div>
      </div>

      <Reveal className="grid-2">
        <section className="card">
          <div className="card__head"><h2 className="card__title">{t("me.activity")}</h2></div>
          {daily.length > 1 ? (
            <LineChart height={210} labels={daily.map((d) => d.date.slice(5))} series={[
              { key: "a", label: t("profile.actions"), color: "#6366f1", values: daily.map((d) => d.actions) },
              { key: "m", label: t("me.minutes"), color: "#06b6d4", values: daily.map((d) => Math.round(d.activeSeconds / 60)) },
            ]} />
          ) : <p className="muted small">{t("me.noActivity")}</p>}
        </section>
        <section className="card">
          <div className="card__head"><h2 className="card__title">{t("me.whatYouDo")}</h2></div>
          <Donut size={160} thickness={24} centerLabel={t("profile.actions")} slices={actionSlices} />
        </section>
      </Reveal>

      <Reveal>
        <section className="card">
          <div className="card__head"><h2 className="card__title">{t("me.achievements")}</h2><span className="badge badge--accent">{earned}/{badges.length}</span></div>
          <div className="awards">
            {badges.map(({ key, icon: Icon, goal, value, tone }) => {
              const done = value >= goal;
              return (
                <div key={key} className={`award award--${tone} ${done ? "is-done" : ""}`}>
                  <span className="award__icon"><Icon size={22} /></span>
                  <strong>{t(`me.badge.${key}`)}</strong>
                  <small>{t(`me.badge.${key}.how`, { n: goal })}</small>
                  <div className="bar"><i style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} /></div>
                  <em>{done ? t("me.unlocked") : `${Math.min(value, goal)}/${goal}`}</em>
                </div>
              );
            })}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
