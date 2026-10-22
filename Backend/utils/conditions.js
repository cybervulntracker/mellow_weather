// WMO weather code -> { theme for the page colour, text key for translation, icon }
function describeCode(code, isDay = true) {
  if (code === 0) return { condition: isDay ? "sunny" : "night", key: isDay ? "clear" : "clearNight", icon: "clear" };
  if (code === 1) return { condition: isDay ? "sunny" : "night", key: isDay ? "mostlyClear" : "mostlyClearNight", icon: "partly" };
  if (code === 2) return { condition: "cloudy", key: "partlyCloudy", icon: "partly" };
  if (code === 3) return { condition: "cloudy", key: "overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { condition: "fog", key: "fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { condition: "rain", key: "drizzle", icon: "drizzle" };
  if (code === 61) return { condition: "rain", key: "lightRain", icon: "rain" };
  if (code === 63) return { condition: "rain", key: "rain", icon: "rain" };
  if (code === 65) return { condition: "rain", key: "heavyRain", icon: "rain" };
  if (code === 66 || code === 67) return { condition: "rain", key: "freezingRain", icon: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: "snow", key: "snow", icon: "snow" };
  if (code >= 80 && code <= 82) return { condition: "rain", key: "rainShowers", icon: "rain" };
  if (code >= 95) return { condition: "storm", key: "thunderstorm", icon: "storm" };
  return { condition: "cloudy", key: "cloudy", icon: "cloud" };
}

const isWetCode = (code) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

module.exports = { describeCode, isWetCode };
