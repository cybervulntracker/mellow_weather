import { Star } from "lucide-react";
import PlacesTable from "./PlacesTable";

export default function Favorites() {
  return <PlacesTable kind="favorites" icon={Star} title="Favourites" subtitle="Places people have saved to their accounts." topTitle="Most saved cities" />;
}
