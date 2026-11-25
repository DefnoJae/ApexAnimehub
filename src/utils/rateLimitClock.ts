export interface RateLimitHeaders {
  get(name: string): string | null;
}

let retryAt = 0;
const listeners = new Set<() => void>();

export function getRateLimitRetryAt(): number {
  return retryAt;
}

export function subscribeRateLimit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setRateLimitRetryAt(next: number): void {
  if (next > retryAt) {
    retryAt = next;
  } else if (next <= Date.now() && retryAt !== 0) {
    retryAt = 0;
  } else {
    return;
  }
  listeners.forEach((listener) => listener());
}

function future(timestamp: number, now: number): number | null {
  return Number.isFinite(timestamp) && timestamp > now ? timestamp : null;
}

function parseReset(raw: string | null, now: number): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const value = Number(raw);
    // AniList sends Unix seconds; tolerate a millisecond timestamp too.
    return future(value > 1e12 ? value : value * 1000, now);
  }
  return future(Date.parse(raw), now);
}

function parseRetryAfter(raw: string | null, now: number): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return future(now + Number(raw) * 1000, now);
  return future(Date.parse(raw), now);
}

export function parseRateLimitHeaders(
  headers: RateLimitHeaders | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!headers) return null;
  // AniList exposes X-RateLimit-Reset; Retry-After is a seconds fallback.
  return (
    parseReset(headers.get("X-RateLimit-Reset"), now) ??
    parseRetryAfter(headers.get("Retry-After"), now)
  );
}
