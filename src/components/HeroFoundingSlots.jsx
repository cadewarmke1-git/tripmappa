import { useEffect, useState } from "react";
import { fetchFoundingSlotsRemaining } from "../lib/foundingSlotsApi.js";

const POLL_MS = 20000;

export default function HeroFoundingSlots() {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchFoundingSlotsRemaining();
        if (!cancelled) setRemaining(data.remaining);
      } catch {
        if (!cancelled) setRemaining(null);
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (remaining == null) return null;

  return (
    <div className="hero-founding-badge" aria-live="polite">
      <span className="hero-founding-badge-label">Founding Members</span>
      <span className="hero-founding-badge-sep" aria-hidden="true">·</span>
      <span className="hero-founding-badge-count">
        {remaining.toLocaleString()} spots remaining
      </span>
    </div>
  );
}
