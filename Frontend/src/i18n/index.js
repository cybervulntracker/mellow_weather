import en from "./en";
import hi from "./hi";

const DICTIONARIES = { en, hi };

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
];

// t("key", { name: "Sam" }) -> text in the chosen language, falling back to English
export const makeT = (language) => (key, params = {}) => {
  const text = DICTIONARIES[language]?.[key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
};
