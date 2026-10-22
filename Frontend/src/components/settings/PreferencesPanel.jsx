import { LANGUAGES } from "../../i18n";
import { usePrefs } from "../../context/PrefsContext";
import { DISTANCE_UNITS, PRECIP_UNITS, PRESSURE_UNITS, WIND_UNITS } from "../../lib/units";

function Choice({ label, value, options, onChange }) {
  return (
    <div className="pref">
      <span className="pref__label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map(([id, text]) => (
          <button key={id} className={`segmented__btn ${value === id ? "is-active" : ""}`} onClick={() => onChange(id)} aria-pressed={value === id}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export default function PreferencesPanel() {
  const { t, unit, windUnit, pressureUnit, precipUnit, distanceUnit, clock, theme, language, updatePrefs } = usePrefs();
  return (
    <div className="stack">
      <section className="card">
        <div className="card__head"><h2 className="card__title">{t("prefs.units")}</h2></div>
        <Choice label={t("prefs.temperature")} value={unit} options={[["C", "°C"], ["F", "°F"]]} onChange={(v) => updatePrefs({ preferredUnit: v })} />
        <Choice label={t("prefs.wind")} value={windUnit} options={Object.entries(WIND_UNITS)} onChange={(v) => updatePrefs({ windUnit: v })} />
        <Choice label={t("prefs.pressure")} value={pressureUnit} options={Object.entries(PRESSURE_UNITS)} onChange={(v) => updatePrefs({ pressureUnit: v })} />
        <Choice label={t("prefs.precip")} value={precipUnit} options={Object.entries(PRECIP_UNITS)} onChange={(v) => updatePrefs({ precipUnit: v })} />
        <Choice label={t("prefs.distance")} value={distanceUnit} options={Object.entries(DISTANCE_UNITS)} onChange={(v) => updatePrefs({ distanceUnit: v })} />
        <Choice label={t("prefs.clock")} value={clock} options={[["12h", t("clock.12h")], ["24h", t("clock.24h")]]} onChange={(v) => updatePrefs({ clock: v })} />
      </section>
      <section className="card">
        <div className="card__head"><h2 className="card__title">{t("prefs.appearance")}</h2></div>
        <Choice label={t("prefs.theme")} value={theme} options={[["system", t("theme.system")], ["light", t("theme.light")], ["dark", t("theme.dark")]]} onChange={(v) => updatePrefs({ theme: v })} />
        <Choice label={t("prefs.language")} value={language} options={LANGUAGES.map((l) => [l.code, l.name])} onChange={(v) => updatePrefs({ language: v })} />
      </section>
    </div>
  );
}
