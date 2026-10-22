import { useState } from "react";
import { usePrefs } from "../../context/PrefsContext";
import PreferencesPanel from "../../components/settings/PreferencesPanel";
import NotificationSettings from "../../components/settings/NotificationSettings";
import SecurityPanel from "../../components/settings/SecurityPanel";
import SupportPanel from "../../components/settings/SupportPanel";

const TABS = [["preferences", PreferencesPanel], ["notifications", NotificationSettings], ["security", SecurityPanel], ["help", SupportPanel]];

export default function Settings() {
  const { t } = usePrefs();
  const [tab, setTab] = useState("preferences");
  const Panel = TABS.find(([id]) => id === tab)[1];

  return (
    <div className="page page--narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("profile.account")}</p>
          <h1 className="page-title">{t("settings.title")}</h1>
        </div>
      </div>
      <div className="segmented mb-16" role="tablist">
        {TABS.map(([id]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`segmented__btn ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>{t(`settings.tab.${id}`)}</button>
        ))}
      </div>
      <Panel />
    </div>
  );
}
