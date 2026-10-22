# What changed in version 2

## Run it
    cd Backend  && npm install && npm start          # port 7000
    cd Frontend && npm install && npm run dev        # http://localhost:5173
Copy `Backend/.env.example` settings you need into `Backend/.env` (nothing new is required to start).

## Checks
    cd Backend  && npm test                 # 27 unit tests
    cd Backend  && npm run check:apis       # tests the REAL weather/geocoding services from your computer
    cd Frontend && npm run check:i18n       # English/Hindi texts are complete

## New
Weather: forecast alerts, air quality + pollen, rain radar, rain-in-X-minutes, sun arc / golden hour / moon,
"why it feels hotter", smart summary, "warmer than usual", 7-day + 30-day charts, wind/pressure/clock units,
good-day-for advice, compare cities, trip planner, search autocomplete, favourites (reorder, rename, home city),
recent places, in-app + email notifications, custom alert rules.
Accounts: forgot password, email verification, Google sign-in, two-factor (authenticator app), active devices,
download my data, delete my account. Dark mode (website + admin). English + Hindi.

## Fixed
- Wrong places (e.g. "Gujarat" found in Nepal): places are now ranked, ambiguous names ask the person to choose,
  and the exact coordinates picked are used (not a second name search).
- A second weather source (MET Norway) takes over if Open-Meteo fails or sends impossible values.
- Search/history now remember exact coordinates.
