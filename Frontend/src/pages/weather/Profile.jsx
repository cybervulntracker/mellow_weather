import ProfileEditor from "../../components/ProfileEditor";
import ProfileInsights from "../../components/weather/ProfileInsights";
import { usePrefs } from "../../context/PrefsContext";

export default function Profile() {
  const { t } = usePrefs();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("profile.account")}</p>
          <h1 className="page-title">{t("nav.profile")}</h1>
        </div>
      </div>
      <ProfileInsights />
      <div className="mt-24"><ProfileEditor /></div>
    </div>
  );
}
