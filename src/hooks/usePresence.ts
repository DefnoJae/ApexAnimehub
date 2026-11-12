import { useEffect, useState } from "react";

const VISITOR_KEY = "apex_presence_visitor_v1";
const HEARTBEAT_MS = 25000;

function visitorId() {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved && /^[\da-f-]{36}$/i.test(saved)) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function usePresence() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!window.crypto?.randomUUID) return;
    const visitor = visitorId();
    const tab = crypto.randomUUID();
    let sequence = 0;
    let retryAt = 0;
    let announced = false;
    let disposed = false;
    let timer: number | undefined;

    const payload = (state: "active" | "hidden") =>
      JSON.stringify({ visitor, tab, state, sequence: ++sequence });

    const heartbeat = async () => {
      if (
        document.visibilityState !== "visible" ||
        disposed ||
        Date.now() < retryAt
      )
        return;
      announced = true;
      const body = payload("active");
      const sent = sequence;
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          body,
        });
        const retryAfter = Number(response.headers.get("Retry-After"));
        if (!response.ok && retryAfter > 0) {
          retryAt = Date.now() + Math.min(retryAfter, 300) * 1000;
          if (sent === sequence) announced = false;
        }
        const data = response.ok ? await response.json() : null;
        if (!disposed && sent === sequence)
          setCount(
            Number.isSafeInteger(data?.count) && data.count >= 0
              ? data.count
              : null,
          );
      } catch {
        if (!disposed && sent === sequence) setCount(null);
      }
    };

    const leave = () => {
      window.clearInterval(timer);
      timer = undefined;
      if (!announced) return;
      announced = false;
      const body = payload("hidden");
      if (
        navigator.sendBeacon?.(
          "/api/presence",
          new Blob([body], { type: "application/json" }),
        )
      )
        return;
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body,
        keepalive: true,
      }).catch(() => {});
    };

    const syncVisibility = () => {
      if (document.visibilityState !== "visible") {
        leave();
        setCount(null);
      } else if (timer === undefined) {
        void heartbeat();
        timer = window.setInterval(() => void heartbeat(), HEARTBEAT_MS);
      }
    };

    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", syncVisibility);
    syncVisibility();
    return () => {
      disposed = true;
      leave();
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", syncVisibility);
    };
  }, []);
  return count;
}
