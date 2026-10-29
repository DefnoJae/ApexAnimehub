import { useSyncExternalStore } from "react";
export type RatingSource = "anilist" | "mal" | "both";
const KEY = "apex_rating_source_v1",
  EVENT = "apex-rating-source";
function read(): RatingSource {
  try {
    const value = localStorage.getItem(KEY);
    return value === "mal" || value === "both" ? value : "anilist";
  } catch {
    return "anilist";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useRatingSource() {
  const value = useSyncExternalStore(
    subscribe,
    read,
    () => "anilist" as RatingSource,
  );
  return [
    value,
    (next: RatingSource) => {
      try {
        localStorage.setItem(KEY, next);
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
  ] as const;
}
