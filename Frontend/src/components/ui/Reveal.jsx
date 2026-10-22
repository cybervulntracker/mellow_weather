import { useInView } from "../../hooks/useMotion";

/** Fades and lifts its children in when they scroll into view. `delay` is in ms. */
export default function Reveal({ children, delay = 0, as: Tag = "div", className = "", ...rest }) {
  const [ref, seen] = useInView();
  return (
    <Tag ref={ref} className={`reveal ${seen ? "is-in" : ""} ${className}`} style={{ "--d": `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
