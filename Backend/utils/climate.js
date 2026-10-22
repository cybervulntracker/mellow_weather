// "What is normal for this date?" from 10 years of history.

const round1 = (n) => Math.round(n * 10) / 10;
const average = (list) => list.reduce((a, b) => a + b, 0) / list.length;

// Average high/low/rain for a calendar date, using +/- 3 days around it in each past year.
function normalFor(climate, dateStr, windowDays = 3) {
  climate.index ??= new Map(climate.dates.map((d, i) => [d, i]));
  const [, month, day] = dateStr.split("-").map(Number);
  const lastYear = Number(climate.dates[climate.dates.length - 1].slice(0, 4));
  const highs = [], lows = [], rain = [];

  for (let year = lastYear - 9; year <= lastYear; year++) {
    for (let offset = -windowDays; offset <= windowDays; offset++) {
      const key = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
      const i = climate.index.get(key);
      if (i != null && climate.tmax[i] != null && climate.tmin[i] != null) {
        highs.push(climate.tmax[i]);
        lows.push(climate.tmin[i]);
        rain.push(climate.precip[i] ?? 0);
      }
    }
  }
  if (highs.length < 20) return null; // not enough history to say anything honest

  const max = average(highs), min = average(lows);
  return { max, min, mean: (max + min) / 2, precipMm: average(rain), rainyShare: rain.filter((r) => r >= 1).length / rain.length };
}

function compareToNormal(normal, todayMax, todayMin) {
  if (!normal) return null;
  const delta = (todayMax + todayMin) / 2 - normal.mean;
  return {
    key: delta >= 1.5 ? "warmer" : delta <= -1.5 ? "cooler" : "typical",
    deltaC: round1(Math.abs(delta)),
    normalMeanC: round1(normal.mean),
  };
}

module.exports = { normalFor, compareToNormal };
