import { useCountUp } from "../../hooks/useMotion";

/** A number that counts up when it first appears. */
export default function Counter({ value, decimals = 0, format }) {
  const n = useCountUp(value, { decimals });
  return <>{format ? format(n) : n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
