import { Moon, Sun } from "lucide-react";
import { usePrefs } from "../context/PrefsContext";

// One click flips between light and dark (the Settings page also offers "match my device").
export default function ThemeToggle() {
  const { resolvedTheme, updatePrefs, t } = usePrefs();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <button className="icon-btn icon-btn--lg" onClick={() => updatePrefs({ theme: next })} aria-label={t("theme.toggle")} title={t(`theme.${next}`)}>
      {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
