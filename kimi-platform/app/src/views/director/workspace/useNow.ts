import { useEffect, useState } from "react";

/**
 * Ticking clock for age/lease displays. `Date.now()` during render is
 * impure (react-hooks/purity); the tick lives in an effect instead.
 * Returns 0 until the first tick so derived ages clamp to 0.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // Ticks arrive via the interval callback (an external system), never as
    // a synchronous setState inside the effect body.
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
