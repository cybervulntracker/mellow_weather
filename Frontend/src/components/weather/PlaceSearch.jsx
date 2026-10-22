import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { api } from "../../lib/api";
import { usePrefs } from "../../context/PrefsContext";

/**
 * Search box with suggestions (city, state, country). Choosing a suggestion hands back
 * the exact place with coordinates, so "Springfield" can never silently become the wrong one.
 */
export default function PlaceSearch({ onSelect, onLocate, placeholder, autoFocus = false }) {
  const { t } = usePrefs();
  const [text, setText] = useState("");
  const [state, setState] = useState({ query: "", results: [], ambiguous: false, failed: false });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const box = useRef(null);

  const query = text.trim();
  const ready = query.length >= 2 && state.query === query;
  const results = ready ? state.results : [];

  // look up suggestions 250 ms after typing stops
  useEffect(() => {
    if (query.length < 2) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api(`/geo/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        setState({ query, results: data.results, ambiguous: data.ambiguous, failed: false });
      } catch (error) {
        if (error.name !== "AbortError") setState({ query, results: [], ambiguous: false, failed: true });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(place) {
    setText("");
    setOpen(false);
    setActive(-1);
    onSelect(place);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) choose(results[active]);
      else if (results.length && !state.ambiguous) choose(results[0]); // one clear winner
      else setOpen(true); // several similar places: the person must pick
    }
  }

  const showList = open && query.length >= 2;

  return (
    <div className="placesearch" ref={box}>
      <div className="searchbar">
        <Search size={18} className="searchbar__icon" />
        <input
          className="searchbar__input" value={text} placeholder={placeholder || t("search.placeholder")} autoFocus={autoFocus}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)} onKeyDown={onKeyDown} maxLength={100} autoComplete="off"
          role="combobox" aria-expanded={showList} aria-controls="place-options" aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `place-option-${active}` : undefined} aria-label={t("search.placeholder")}
        />
        {onLocate && (
          <button type="button" className="searchbar__locate" onClick={onLocate} title={t("search.locate")} aria-label={t("search.locate")}>
            <LocateFixed size={18} />
          </button>
        )}
      </div>

      {showList && (
        <ul className="suggest" id="place-options" role="listbox">
          {state.ambiguous && results.length > 0 && <li className="suggest__note">{t("search.ambiguous")}</li>}
          {results.map((place, i) => (
            <li key={`${place.latitude},${place.longitude}`} id={`place-option-${i}`} role="option" aria-selected={i === active}
              className={`suggest__item ${i === active ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); choose(place); }} onMouseEnter={() => setActive(i)}>
              <MapPin size={16} />
              <span className="suggest__text">
                <strong>{place.name}</strong>
                <span>{[place.admin1, place.country].filter(Boolean).join(", ")}</span>
              </span>
            </li>
          ))}
          {!results.length && <li className="suggest__note">{loading || !ready ? t("common.loading") : state.failed ? t("search.unavailable") : t("search.noResults")}</li>}
        </ul>
      )}
    </div>
  );
}
