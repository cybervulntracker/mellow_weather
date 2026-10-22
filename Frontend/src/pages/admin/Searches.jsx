import { Search } from "lucide-react";
import PlacesTable from "./PlacesTable";

export default function Searches() {
  return <PlacesTable kind="searches" icon={Search} title="Searches" subtitle="Which cities people look up, and how often." topTitle="Most searched cities" />;
}
