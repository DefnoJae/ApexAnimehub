import { useSyncExternalStore } from "react";
const KEY = "apex_prefer_signs_songs_v1";
const EVENT = "apex-prefer-signs-songs";
function read() {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
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
export function usePreferSignsSongs() {
  const visible = useSyncExternalStore(subscribe, read, () => false);
  return [
    visible,
    (next: boolean) => {
      try {
        localStorage.setItem(KEY, String(next));
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
  ] as const;
}
