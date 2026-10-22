import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";

// [day icon, night icon] for every icon key the API can return
const ICONS = {
  clear: [Sun, Moon],
  partly: [CloudSun, CloudMoon],
  cloud: [Cloud, Cloud],
  fog: [CloudFog, CloudFog],
  drizzle: [CloudDrizzle, CloudDrizzle],
  rain: [CloudRain, CloudRain],
  snow: [CloudSnow, CloudSnow],
  storm: [CloudLightning, CloudLightning],
};

export default function WeatherIcon({ name = "cloud", isDay = true, size = 24, strokeWidth = 1.6, className = "" }) {
  const [Day, Night] = ICONS[name] || ICONS.cloud;
  const Icon = isDay ? Day : Night;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}
