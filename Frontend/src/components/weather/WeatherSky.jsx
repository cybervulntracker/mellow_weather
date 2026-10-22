import WeatherScene from "../ui/WeatherScene";
import { useWeather } from "../../context/WeatherContext";

// A faint animated sky across the top of every weather page, matching what it's like outside.
export default function WeatherSky() {
  const { weather } = useWeather();
  const kind = weather?.condition || "sunny";
  return (
    <div className={`wsky wsky--${kind}`} aria-hidden="true">
      <WeatherScene kind={kind} density={0.55} />
    </div>
  );
}
