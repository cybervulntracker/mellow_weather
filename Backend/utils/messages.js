// Wording for emails and push messages, in English and Hindi.
// (In the app itself, the browser translates the same { key, params } lines.)
const TEXT = {
  en: {
    tips: {
      umbrella: "Take an umbrella", sunscreen: "Wear sunscreen", mask: "Wear a mask outdoors (poor air quality)",
      hydrate: "Drink plenty of water", jacket: "Carry a jacket",
    },
    rule: {
      tempMax: (v, t) => `The forecast high of ${v}°C is above your limit of ${t}°C`,
      tempMin: (v, t) => `The forecast low of ${v}°C is at or below your limit of ${t}°C`,
      rainProb: (v, t) => `Chance of rain is ${v}% (your limit: ${t}%)`,
      windMax: (v, t) => `Wind up to ${v} km/h (your limit: ${t} km/h)`,
      uvMax: (v, t) => `UV index ${v} (your limit: ${t})`,
      aqi: (v, t) => `Air quality index ${v} (your limit: ${t})`,
    },
    rainNowEndsAt: (c) => `It is raining now and should clear around ${c}.`,
    rainNowAllDay: "It is raining now and rain is expected to continue.",
    rainAt: (c) => `Expect rain around ${c}.`,
    dryAhead: "No rain expected in the next 12 hours.",
    highToday: (p) => `Today's high will be ${p.high}°C.`,
    rainTomorrowLine: (p) => `Rain is likely tomorrow (${p.prob}% chance, about ${p.mm} mm).`,
    supportReplyLine: (p) => `An admin replied to your message "${p.subject}".`,
    subjects: { digest: "your morning forecast", rain: "rain tomorrow", rule: "your alert", support: "a reply from support" },
    footer: "Change these emails in MellowWeather → Settings → Notifications.",
    am: "AM", pm: "PM",
  },
  hi: {
    tips: {
      umbrella: "छाता साथ रखें", sunscreen: "सनस्क्रीन लगाएँ", mask: "बाहर मास्क पहनें (हवा खराब है)",
      hydrate: "खूब पानी पिएँ", jacket: "जैकेट साथ रखें",
    },
    rule: {
      tempMax: (v, t) => `अनुमानित अधिकतम तापमान ${v}°C आपकी सीमा ${t}°C से ऊपर है`,
      tempMin: (v, t) => `अनुमानित न्यूनतम तापमान ${v}°C आपकी सीमा ${t}°C या उससे कम है`,
      rainProb: (v, t) => `बारिश की संभावना ${v}% है (आपकी सीमा: ${t}%)`,
      windMax: (v, t) => `हवा ${v} किमी/घंटा तक (आपकी सीमा: ${t} किमी/घंटा)`,
      uvMax: (v, t) => `यूवी इंडेक्स ${v} (आपकी सीमा: ${t})`,
      aqi: (v, t) => `वायु गुणवत्ता सूचकांक ${v} (आपकी सीमा: ${t})`,
    },
    rainNowEndsAt: (c) => `अभी बारिश हो रही है और लगभग ${c} तक थम जानी चाहिए।`,
    rainNowAllDay: "अभी बारिश हो रही है और जारी रहने की संभावना है।",
    rainAt: (c) => `लगभग ${c} के आसपास बारिश की संभावना है।`,
    dryAhead: "अगले 12 घंटों में बारिश की उम्मीद नहीं है।",
    highToday: (p) => `आज का अधिकतम तापमान ${p.high}°C रहेगा।`,
    rainTomorrowLine: (p) => `कल बारिश की संभावना है (${p.prob}% संभावना, लगभग ${p.mm} मिमी)।`,
    supportReplyLine: (p) => `आपके संदेश "${p.subject}" का जवाब एडमिन ने दिया है।`,
    subjects: { digest: "आपका सुबह का पूर्वानुमान", rain: "कल बारिश", rule: "आपका अलर्ट", support: "सहायता का जवाब" },
    footer: "ये ईमेल MellowWeather → सेटिंग्स → सूचनाएँ में बदलें।",
    am: "पूर्वाह्न", pm: "अपराह्न",
  },
};

const pick = (lang) => TEXT[lang] || TEXT.en;
const clock = (iso, lang) => {
  const t = pick(lang);
  const hour = Number(iso.slice(11, 13));
  return `${hour % 12 || 12}${iso.slice(13, 16) === ":00" ? "" : iso.slice(13, 16)} ${hour >= 12 ? t.pm : t.am}`;
};

function renderLine(line, lang = "en") {
  const t = pick(lang);
  const p = line.params || {};
  switch (line.key) {
    case "rainNowEndsAt": return t.rainNowEndsAt(clock(p.time, lang));
    case "rainNowAllDay": return t.rainNowAllDay;
    case "rainAt": return t.rainAt(clock(p.time, lang));
    case "dryAhead": return t.dryAhead;
    case "highToday": return t.highToday(p);
    case "tips": return p.list.map((k) => t.tips[k]).filter(Boolean).join(lang === "hi" ? "। " : ". ") + (p.list.length ? (lang === "hi" ? "।" : ".") : "");
    case "rainTomorrowLine": return t.rainTomorrowLine(p);
    case "supportReplyLine": return t.supportReplyLine(p);
    default:
      if (line.key.startsWith("rule_")) return t.rule[line.key.slice(5)](p.value, p.threshold) + (lang === "hi" ? "।" : ".");
      return "";
  }
}

const subjectFor = (kind, lang = "en") => pick(lang).subjects[kind] || "";
const footerFor = (lang = "en") => pick(lang).footer;

module.exports = { renderLine, subjectFor, footerFor };
