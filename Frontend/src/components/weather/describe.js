// Words for the numbers in the "conditions" grid. Each function returns a translation key suffix.

export const humidityLevel = (v) => (v < 30 ? "dry" : v <= 60 ? "comfortable" : v <= 80 ? "humid" : "veryHumid");
export const windLevel = (kmh) => (kmh < 6 ? "calm" : kmh < 20 ? "lightBreeze" : kmh < 40 ? "breezy" : kmh < 60 ? "windy" : "strong");
export const visibilityLevel = (km) => (km >= 10 ? "clear" : km >= 5 ? "moderate" : km >= 2 ? "hazy" : "poor");
export const uvLevel = (uv) => (uv <= 2 ? "low" : uv <= 5 ? "moderate" : uv <= 7 ? "high" : uv <= 10 ? "veryHigh" : "extreme");
export const pressureLevel = (hpa) => (hpa < 1000 ? "low" : hpa <= 1020 ? "normal" : "high");
export const rainLevel = (p) => (p < 20 ? "unlikely" : p < 50 ? "possible" : "likely");

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg) => COMPASS[Math.round((deg ?? 0) / 45) % 8];
