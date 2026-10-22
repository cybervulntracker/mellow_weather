# MellowWeather — What was changed, what was NOT done, and how to do it

> **UPDATE — version 3 (16 Oct 2026):** most of Part 2 below has now been done. See `CHANGELOG.md` for the exact list.
> Done: 2.5 push, 2.6 (US only), 2.7, 2.8 (optional key), 2.9, 2.12 (no CAPTCHA), 2.13, 2.14, 2.16 (optional key), 2.17, 2.18 (golden hour, units, pressure trend), 2.19 (all except impersonation and extra roles), 2.20 (unit tests only).
> Still open: 2.1, 2.3, 2.4 (need your computer / accounts), 2.10 admin in Hindi, 2.11 more languages, 2.15 dnd-kit, E2E tests with a real DB.
> Section 2.2 is partly done: the screens were checked in a real browser, but with mocked data.


This file has three parts:

1. **What I changed** in the zip (`backend_practice_v2.tar.gz`)
2. **What I could not do, or only did partly** — and exactly how each one can be done
3. **What is proven and what is not** (so you know what to check first)

---

## Part 1 — What I changed

### A. From your original project (first round of work)

| Area | Change |
|---|---|
| Admin "Not tracked" problem | Active time and actions are now really measured. Every action goes through one function (`Backend/utils/track.js`) that writes the activity log, the counters, the daily chart and the session. Active time comes from a heartbeat every ~30 s, only while the tab is visible and the person is using it. |
| Admin panel | Redesigned. 9 working pages: Dashboard, Users (with a detail drawer), Sessions, Searches, Favourites, Activity log (filters + CSV export), Security, Settings, My profile. Collapsible sidebar, mobile menu. |
| Weather website | Redesigned: Today, Forecast, Favourites, History, Profile. Real icon set (lucide) instead of emoji. |
| Profile photos | Users and admins can upload a photo. It is cropped in the browser and stored in MongoDB. |
| Favourites | Now saved in the database (before they were hard-coded). |
| Bugs fixed | History route was written inside the search handler (only worked after one search). Hourly forecast showed midnight–6 AM instead of the next hours. UV / visibility / pressure were never sent. "Not logged in" was treated as logged in. Login revealed which emails exist. Dev proxy pointed at the wrong port. |
| Your practice code | The `/tasks` page and its backend were left untouched. |

### B. Version 2 (second round — everything on your list)

**Weather data**
- Weather alerts: heat, cold, heavy rain, strong wind, thunderstorm, extreme UV, poor air, fog (shown as a banner).
- Air quality (US AQI) with pollutants, plus pollen where data exists.
- Rain radar map (Leaflet + RainViewer), loaded only when the Radar tab is opened.
- "Rain starts in about 30 min" (15-minute rain data).
- Sunrise/sunset arc, golden hour, moon phase.
- "Why it feels hotter/colder" explanation.
- Smart summary line ("Expect rain around 7 PM. Take an umbrella.") plus tips.
- "Warmer than usual for this time of year" using 10 years of history.
- Weekly and 30-day temperature + rainfall charts.
- More units: wind (km/h, mph, m/s), pressure (hPa, inHg), 12/24-hour clock.
- "Good day for…" advice: running, drying laundry, travel, outdoors.

**Search and places**
- Search suggestions while typing (city, state, country).
- Compare 2–4 places side by side.
- Favourites: drag to reorder (plus left/right buttons), rename, pin a home city.
- Recently viewed places, even if you never typed them.
- Trip planner: real forecast for the next 16 days, "typical weather" (10-year average) after that.

**Personalisation and alerts**
- Notification bell, daily morning digest, "rain tomorrow" alerts (in-app + email).
- Custom alert rules ("tell me if the high goes above 40°").
- Dark mode in the website **and** the admin panel (no white flash on load).
- English and Hindi (website, sign-in pages, notifications).

**Accounts**
- Forgot password / reset by email link (one-time, 1 hour, signs out other devices).
- Email verification (banner until confirmed).
- Google sign-in (button appears only when `GOOGLE_CLIENT_ID` is set).
- Two-factor authentication with an authenticator app and 8 backup codes (codes cannot be re-used).
- Active devices list with remote sign-out.
- Download my data (JSON) and delete my account.

**The "Gujarat in Nepal" / wrong-answer problem**
- Places are found with two databases, merged, de-duplicated and ranked (type, population, exact name). Ambiguous names make the person choose.
- The exact coordinates of the chosen suggestion are used (no second search by name).
- Recent places and favourites remember coordinates too.
- A second weather source (MET Norway) takes over if Open-Meteo fails or sends impossible numbers (e.g. 999 °C). The page shows a "backup data" notice.
- Weather answers are cached for 5 minutes.

**Code quality (as you asked)**
- No unused functions or imports: lint is clean in both folders, and a scan for unused exports found none. Two things I noticed and fixed: an unused parameter in the scheduler, and an over-complicated helper.
- Translations checked by a script: 480 keys, identical in English and Hindi, none missing, none unused.
- Files removed because they became unnecessary: `SearchBar.jsx`, `UnitToggle.jsx`.
- Files moved: the old `Frontend/pages` folder is now `Frontend/src/pages`.

**Extras added to the zip**
- `Backend/tests/` (27 unit tests, run with `npm test`)
- `Backend/scripts/checkApis.js` (tests the real services, `npm run check:apis`)
- `Backend/.env.example`
- `Frontend/scripts/check-i18n.mjs` (`npm run check:i18n`)
- `PROJECT_GUIDE.md` (beginner guide with diagrams) and `CHANGES.md`

---

## Part 2 — What I could NOT do (or only did partly), and how to do it

Each item says **why** it is not done and **how** to do it.

### 2.1 Checking the real outside services (most important)
- **Status:** not done. The real Open-Meteo, MET Norway, Photon, RainViewer and Google services could not be reached from my environment, so I tested with realistic fake answers.
- **How to do it:** in the `Backend` folder run `npm run check:apis`. It checks that Gujarat, Delhi, Mumbai, Kathmandu, Paris, London, Tokyo, Sydney, New York and Lagos land in the right country, that "Springfield" asks the person to choose, and that Open-Meteo and MET Norway agree within a few degrees. If something shows ✗ or !, copy the output to me (or read the line: it names the city and the service) and fix the ranking in `Backend/utils/geo.js` or the mapping in `Backend/providers/`.

### 2.2 Seeing the screens in a real browser
- **Status:** not done. I tested with a simulated browser, so layout, spacing, colours and mobile view were never looked at by eye.
- **How to do it:** run both servers, open each page in light and dark mode and on a phone-size window (browser dev tools → device toolbar). Colours live in `Frontend/src/styles/base.css` (variables at the top); new weather cards are at the end of `weather.css`. For automatic screenshots on your computer: `npm i -D @playwright/test`, then `npx playwright install chromium` and write a small test that opens each route and calls `page.screenshot()`.

### 2.3 Real emails (SMTP)
- **Status:** the email code is written but only the "print to terminal" mode was tested.
- **How to do it:** fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` in `Backend/.env`. For a safe test use Mailtrap or a Gmail "app password". Send yourself a reset link and a verification link.

### 2.4 Google sign-in
- **Status:** built and tested with a fake Google, but it needs **your** Google client ID.
- **How to do it:** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (*Web application*) → add `http://localhost:5173` (and your real domain later) under *Authorised JavaScript origins* → put the Client ID in `GOOGLE_CLIENT_ID` in `Backend/.env` → restart the backend. The button then appears on the login and signup pages.

### 2.5 Push notifications (phone / browser pop-ups)
- **Status:** not built. You get in-app notifications (bell) and email.
- **How to do it:** add a service worker in `Frontend/public/sw.js`, ask the browser for permission, create VAPID keys (`npx web-push generate-vapid-keys`), add a `PushSubscription` model, a route to save subscriptions, and in `Backend/utils/scheduler.js` inside `notify()` also call `webpush.sendNotification(...)` (package `web-push`).

### 2.6 Official government weather warnings
- **Status:** not built. The alerts are **computed from forecast numbers** and the page says "not official warnings".
- **How to do it:** official warnings come from each country's service and need a separate source per region: India — IMD (CAP feeds), USA — api.weather.gov alerts, Europe — MeteoAlarm. Add a file `Backend/providers/alerts.js` that picks the right source from the country code, convert them into the same `{ type, severity, date }` shape used in `Backend/utils/insights.js`, and show the official source name in `AlertsBanner.jsx`.

### 2.7 True minute-by-minute rain
- **Status:** it is **15-minute** steps. Free data does not give every minute.
- **How to do it:** use a paid/keyed provider that has 1-minute nowcasts (for example Tomorrow.io or OpenWeatherMap One Call). Add a provider file beside `openmeteo.js` that returns the same `minutely` list and change `fetchForecast` to use it when a key is set.

### 2.8 Pollen outside Europe
- **Status:** not available. The free source only has European pollen; the card says so.
- **How to do it:** add a keyed pollen source (for example Google Pollen API or Tomorrow.io) in `Backend/providers/` and merge its values into `normalizeAir` in `openmeteo.js` when Open-Meteo returns none.

### 2.9 Emails in Hindi
- **Status:** emails are English only (the in-app bell is translated).
- **How to do it:** in `Backend/utils/messages.js` add a second table of texts for `hi`, give `renderLine` a `language` argument, and pass `user.language` from `Backend/utils/scheduler.js` and from the subjects in `authController.js`.

### 2.10 Admin console in Hindi (or other languages)
- **Status:** the admin console stays English on purpose (`PrefsOverride` in `AdminLayout.jsx`); many admin texts are written directly in the components.
- **How to do it:** move each admin text into `Frontend/src/i18n/en.js` and `hi.js` as keys (`t("admin.users.title")`), use `t()` in the admin pages, then remove `PrefsOverride`. `npm run check:i18n` will tell you what is missing.

### 2.11 More languages
- **Status:** only English and Hindi.
- **How to do it:** copy `Frontend/src/i18n/en.js` to a new file, translate the values, register it in `Frontend/src/i18n/index.js` and add its code to `PREF_OPTIONS.language` in `Backend/models/Users.js`. Run `npm run check:i18n`.

### 2.12 Full-API rate limiting and CAPTCHA
- **Status:** not added. What exists: login lock after 8 wrong attempts, 2FA lock, 5 reset emails per 15 minutes, resend limits.
- **How to do it:** `npm i express-rate-limit`, then in `app.js` add `app.use("/api", rateLimit({ windowMs: 60000, limit: 120 }))` and a stricter limit on `/api/auth`. For CAPTCHA add hCaptcha or Cloudflare Turnstile to the signup/login forms and verify the token in `authController.js`.

### 2.13 Production hardening
- **Status:** not done (this is a development setup).
- **How to do it:** serve over HTTPS; in `app.js` set the session cookie to `secure: true, sameSite: "lax"` (and `app.set("trust proxy", 1)` behind a proxy); add the `helmet` package; set `CLIENT_URL` to your real domain; use a long random `SESSION_SECRET`; run behind a process manager (pm2) and use a hosted MongoDB.

### 2.14 Notifications on a separate worker
- **Status:** the scheduler runs inside the same Node process as the website. If the server is off at the chosen hour, that digest is skipped. Two server copies would both run it (the duplicate guard prevents double messages, but wastes work).
- **How to do it:** move `startScheduler()` into its own small script (`worker.js`) run as a separate process, or use a queue such as BullMQ with Redis.

### 2.15 Drag-and-drop on phones
- **Status:** partly done. Drag-and-drop works with a mouse; on touch screens the left/right "Move" buttons are the alternative.
- **How to do it:** replace the HTML5 drag code in `Favorites.jsx` with the `@dnd-kit/core` and `@dnd-kit/sortable` packages (they support touch).

### 2.16 Search suggestions depend on a free public server
- **Status:** the Photon server (komoot) is a fair-use public service and may slow down or refuse heavy traffic. If it fails, Open-Meteo's search still works alone.
- **How to do it:** self-host Photon, or switch `searchPhoton` in `Backend/utils/geo.js` to a keyed service (Mapbox, Geoapify, Google Places).

### 2.17 Sessions created before version 2 cannot be signed out remotely
- **Status:** a limitation. Old sessions have no stored session id, so "sign out this device" cannot target them. They expire on their own within 24 hours.
- **How to do it:** to force everyone to sign in again once, delete the `sessions` collection in MongoDB.

### 2.18 Approximations you should know about
- **Golden hour** is "the first and last hour of sunlight", not an exact sun-angle calculation. For exact angles use the `suncalc` package in `Backend/utils/astro.js`.
- **Moon phase** is calculated from the average lunar cycle: the illumination percentage is accurate to a few percent.
- **"Typical weather" and "warmer than usual"** use 10 years of computer-model history (ERA5), not weather-station records.
- **Radar** uses RainViewer's free tier (limited zoom, past images). If their rules change, the Radar tab shows a friendly message. Alternative: another tile provider with its own key (for example OpenWeatherMap tile layers) in `RadarMap.jsx`.
- **Rain amounts** are in mm and visibility in km; there is no inches/miles setting. To add: a new preference in `Users.js` and a helper in `Frontend/src/lib/units.js`.
- **City names** are shown in English (no Hindi place names).

### 2.19 Admin ideas I listed earlier but did not build
You asked for the weather and account features, so I did **not** build the admin ideas from my earlier list: date-range pickers on charts, retention/cohort analytics, bulk user actions, impersonation, extra roles, an editable audit trail, system-health page, maintenance mode, scheduled reports, support inbox.
- **How to do it:** each is a new page in `Frontend/src/pages/admin/` plus a route in `Backend/routes/adminRoutes.js`; tell me which ones you want and I will build them one by one.

### 2.20 Automatic tests are only partly included
- **Status:** the zip contains the 27 backend unit tests, the live-API check and the translation check. The large end-to-end test (329 checks) and the browser simulation (96 checks) I used were **not** put in the zip, because they relied on temporary tools in my environment (a stand-in database and fake outside services).
- **How to do it:** for API tests use `mongodb-memory-server` or a test database plus `node:test`; for screen tests use Playwright (see 2.2). I can write them for your machine if you want.

---

## Part 3 — What is proven and what is not

| Thing | Status |
|---|---|
| Backend logic (ranking, fallback, sanity checks, alerts, summary, advice, sun/moon, 2FA codes, encryption, cache) | ✅ 27 unit tests pass |
| Every API route (sign-up, login, 2FA incl. re-used codes, Google, reset, verification, devices, export/delete, notifications, rules, compare, trip, favourites, admin pages) | ✅ 329 end-to-end checks passed (stand-in database + fake outside services) |
| Every screen (English, Hindi, light, dark, Fahrenheit, 24-hour, 2FA flow, search, radar mounting, drag & drop, settings, bell) | ✅ 96 checks in a simulated browser, no console errors |
| Lint, unused code, translation completeness, production build, fresh install from the zip | ✅ all pass |
| Real Open-Meteo / MET Norway / Photon / RainViewer / Google answers | ❌ **not tested** → run `npm run check:apis` |
| Real email sending | ❌ not tested → see 2.3 |
| How it looks on a real screen / phone | ❌ not checked → see 2.2 |
| Real MongoDB (I used a compatible stand-in) | ❌ not tested → just run the app against your database and try sign-up, search, favourite, upload a photo |

### Suggested first 10 minutes on your computer
1. `cd Backend && npm install && npm test && npm run check:apis`
2. `cd Frontend && npm install && npm run check:i18n`
3. Start both servers (`npm start` in Backend, `npm run dev` in Frontend).
4. Sign up, then search "Gujarat" — you should see **Gujarat, India** first.
5. Save a place, set it as home, drag it, switch to dark mode and to Hindi.
6. In the Backend terminal copy the printed verification link and open it.
7. Open Forecast → Rain radar, and Settings → Security → set up two-factor.
8. Tell me anything that looks wrong or fails, with a screenshot or the terminal text.
