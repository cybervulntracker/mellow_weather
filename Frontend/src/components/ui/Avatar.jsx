import { useState } from "react";
import { assetUrl } from "../../lib/api";

// Soft, desaturated colours so initials never look neon
const TONES = ["#5b7db1", "#6a8f7b", "#9a7aa8", "#b38a5d", "#7a8aa6", "#a0707a", "#5f8f9c", "#8b8f5a"];

function toneFor(text = "") {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

/** Profile photo if the user uploaded one, otherwise tidy initials. */
export default function Avatar({ user, size = 36, className = "" }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const name = user?.username || "?";
  const src = assetUrl(user?.avatarUrl);
  const showImage = src && failedSrc !== src;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38), background: showImage ? "var(--surface-2)" : toneFor(name) }}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        initials
      )}
    </span>
  );
}
