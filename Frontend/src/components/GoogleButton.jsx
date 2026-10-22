import { useEffect, useRef } from "react";
import { usePrefs } from "../context/PrefsContext";

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

// Google's own "Sign in with Google" button. It hands us a signed token (`credential`) that the server verifies.
export default function GoogleButton({ clientId, onCredential, text = "signin_with" }) {
  const holder = useRef(null);
  const callback = useRef(onCredential);
  const { resolvedTheme, language } = usePrefs();

  useEffect(() => { callback.current = onCredential; }, [onCredential]);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;

    const draw = () => {
      if (cancelled || !holder.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => callback.current(response.credential) });
      window.google.accounts.id.renderButton(holder.current, {
        theme: resolvedTheme === "dark" ? "filled_black" : "outline", size: "large", text, shape: "rectangular", width: holder.current.offsetWidth || 360, locale: language,
      });
    };

    if (window.google?.accounts?.id) draw();
    else {
      let script = document.querySelector(`script[src="${SCRIPT_URL}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_URL;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", draw);
    }
    return () => { cancelled = true; };
  }, [clientId, resolvedTheme, language, text]);

  if (!clientId) return null;
  return <div ref={holder} className="google-btn" />;
}
