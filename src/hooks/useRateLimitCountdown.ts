import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getRateLimitRetryAt,
  subscribeRateLimit,
} from "../utils/rateLimitClock";

export function useRateLimitCountdown() {
  const retryAt = useSyncExternalStore(subscribeRateLimit, getRateLimitRetryAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (retryAt <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const secondsRemaining = retryAt > now ? Math.ceil((retryAt - now) / 1000) : 0;
  return { secondsRemaining, retryAt };
}
