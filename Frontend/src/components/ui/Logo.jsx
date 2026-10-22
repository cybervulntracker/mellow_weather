// Brand mark: a sun rising over a cloud, drawn as a single SVG.
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <circle cx="19.5" cy="12.5" r="4.6" fill="#ffd36b" />
      <path d="M19.5 4.6v1.7M26.4 8.6l-1.2.9M27.5 15.3h-1.7M12.6 8.6l1.2.9" stroke="#ffd36b" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M10.2 25.2h11.1a4.1 4.1 0 0 0 .5-8.2 5.2 5.2 0 0 0-9.9 1.1 3.6 3.6 0 0 0-1.7 7.1Z"
        fill="#fff"
      />
    </svg>
  );
}

export default function Logo({ name = "MellowWeather", size = 30 }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo__text">{name}</span>
    </span>
  );
}
