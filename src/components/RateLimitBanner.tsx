import { useRateLimitCountdown } from "../hooks/useRateLimitCountdown";

export function RateLimitBanner() {
  const { secondsRemaining } = useRateLimitCountdown();
  if (secondsRemaining <= 0) return null;
  return (
    <div className="apex-rate-limit-banner" role="status">
      AniList rate limit · retrying in {secondsRemaining}s
    </div>
  );
}
