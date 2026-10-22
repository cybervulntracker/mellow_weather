# MellowWeather — Change log

Newest first. Version 3 is the work done after `backend_practice_v2`: it finishes the open items from
`CHANGES_AND_TODO.md` (Part 2) and redesigns the whole frontend.

## v3 — 16 Oct 2026

### Backend — open TODO items finished
| TODO | What changed | Files |
|---|---|---|
| 2.12 Rate limiting | `express-rate-limit`: 240 req/min per IP for the API, 60 per 15 min for `/api/auth/*`. Tunable with `API_RATE_LIMIT`, `AUTH_RATE_LIMIT`; `DISABLE_RATE_LIMIT=1` for scripts. (CAPTCHA is **not** added.) | `middleware/rateLimits.js`, `app.js` |
| 2.13 Production hardening | `helmet` security headers; cookie `secure` when `NODE_ENV=production`; `TRUST_PROXY`; `COOKIE_SAMESITE`; the server refuses to start in production with a missing/short `SESSION_SECRET`; `GET /api/health` | `app.js` |
| 2.14 Separate worker | `RUN_SCHEDULER_IN_APP=0` + `npm run worker` runs digests, rain alerts, rules and the weekly report in their own process | `worker.js`, `utils/scheduler.js` |
| 2.9 Hindi emails | Emails and push texts use the person's language (English/Hindi); unknown languages fall back to English | `utils/messages.js`, `utils/scheduler.js` |
| 2.5 Push notifications | Web Push (VAPID): `PushSubscription` model, `/api/push/*`, push sent next to every in-app/email alert, service worker `public/sw.js`, toggle in Settings → Notifications. Needs `VAPID_*` keys. | `utils/push.js`, `routes/pushRoutes.js`, `models/PushSubscription.js`, `Frontend/public/sw.js`, `components/settings/PushToggle.jsx` |
| 2.6 Official warnings | US National Weather Service alerts (`api.weather.gov`) shown above the hero; only requested for places inside the US. (India/IMD and Europe/MeteoAlarm have no stable public API — **not done**.) | `providers/alerts.js`, `components/weather/OfficialAlerts.jsx` |
| 2.7 Minute-by-minute rain | Optional Tomorrow.io source (`TOMORROW_API_KEY`) replaces the 15-minute slots with 1-minute slots; nowcast now carries `stepMin` | `providers/tomorrow.js`, `utils/insights.js` |
| 2.8 Pollen outside Europe | With the same Tomorrow.io key a tree/grass/weed index (0–5) is shown | `providers/tomorrow.js`, `AirQualityCard.jsx` |
| 2.16 Place search | Optional Geoapify source (`GEOAPIFY_KEY`) merged into the ranking | `utils/geo.js` |
| 2.17 Old sessions | `npm run purge-sessions` (dry run) / `-- --apply` closes sessions that have no session id | `scripts/purgeLegacySessions.js` |
| 2.18 Approximations | Golden hour now uses the sun's real altitude (−4° to +6°) instead of "first and last hour"; new rainfall (mm/in) and distance (km/mi) preferences; 48-hour hourly data with humidity, wind, pressure, feels-like, clouds, rain mm, UV; pressure trend | `utils/astro.js`, `services/weatherService.js`, `providers/openmeteo.js`, `models/Users.js` |
| 2.19 Admin ideas | Analytics endpoint (date range, previous-period deltas, hour×weekday heatmap, devices/browsers/OS, session lengths, top cities, failure rate), weekly cohort retention, system health, bulk user actions (suspend/reactivate/verify/delete, max 100, protects you and the last admin), read-only audit trail, support inbox, maintenance mode, weekly email report | `routes/adminInsightsRoutes.js`, `utils/reports.js`, `middleware/maintenance.js`, `models/SupportTicket.js`, `routes/supportRoutes.js` |
| 2.20 Tests | 9 new unit tests (golden hour, NWS/Tomorrow parsing, Hindi wording, Geoapify, richer payload); 36 total pass | `tests/v3.test.js` |

Existing tests updated on purpose: hourly now 48 rows; golden hour is no longer "exactly sunrise + 60 min".

### Frontend — complete redesign (no animation library)
* **Theme** (`styles/modern.css`, `styles/pages.css`): new indigo → violet → cyan palette, glass cards, aurora background, staggered entrance animations, scroll-reveal, shine buttons, lift-on-hover, animated count-up numbers. Respects `prefers-reduced-motion`.
* **Chart kit** (`components/ui/Viz.jsx`, plain SVG): interactive line/area chart (hover crosshair, click legend to hide lines, draws in), grouped/stacked bars, donut with hover focus, heatmap, gauges, rings, sparklines, wind compass. Charts measure their own width so text stays readable.
* **Animated sky** (`WeatherScene.jsx`): sun + rotating rays, moon + stars, drifting clouds, rain, snow, lightning, fog — used in the hero card and as a faint backdrop on every weather page.
* **Login / sign-up / reset pages** (`pages/auth/*`): symmetrical layout (logo, card, tools centred; three feature chips mirrored on each side). **Puffy**, a cloud creature, wanders the whole page, hops, blinks, follows your cursor with her eyes, covers her eyes while you type a password, looks sad on errors and cheers on submit. A raindrop, a sun chick and a bird drift around too.
* **Weather site**: new hero; Hourly explorer (9 metrics × 12/24/48 h, compare with feels-like); wind compass, humidity/rain rings, UV gauge, pressure trend; official alerts; week-at-a-glance charts; **History** (stats, weekday chart, country donut, top places, filter/sort, grouped timeline); **Favourites** (summary + temperature comparison); **Profile** (level, stats, activity charts, 6 achievements); **Settings → Help** (contact the team, see replies); push toggle; rainfall/distance units.
* **Admin**: new Dashboard (range selector, switchable series, KPI cards with trends, donut, gauge, quick actions), **Analytics**, **Support inbox**, **System health**, **Audit trail**, bulk selection on Users, charts on Searches/Favourites, maintenance mode + weekly report switches in Settings, support-inbox badge in the sidebar.
* Maintenance screen for visitors while maintenance mode is on.
* i18n: 596 keys, English and Hindi identical (`npm run check:i18n`).

### Not done (and why)
* 2.1 live API checks — this environment has no internet; run `npm run check:apis` on your computer.
* 2.3 SMTP and 2.4 Google sign-in — need your own accounts/keys.
* 2.10 Admin console in Hindi — the admin pages are still English only (very large job; see CHANGES_AND_TODO.md).
* 2.11 More languages — needs a native speaker to review translations.
* 2.15 dnd-kit — favourites can already be reordered on phones with the ‹ › buttons.
* 2.19 Impersonation and extra roles — security-sensitive design decisions that are yours to make.
* 2.20 End-to-end tests with a real database — MongoDB can't be downloaded here.
* CAPTCHA, IMD / MeteoAlarm warnings.
* Everything involving real servers (push delivery, NWS, Tomorrow.io, Geoapify) is covered by unit tests of the parsing code only, not by live calls.

### How the frontend was checked
Lint (0 errors), i18n check, production build, and screenshots in headless Chromium of login (light/dark), home (light/dark/phone), history, favourites, profile, admin dashboard, analytics, system health — using mocked API responses, because there is no database here.

### Housekeeping
* Removed the unused `framer-motion` dependency from the Frontend (all motion is plain CSS/SVG).
