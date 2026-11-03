import { useSyncExternalStore } from "react";
const KEY = "apex_stories_visible_v1";
const EVENT = "apex-stories-visibility";
function read() {
  try {
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
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
export function useStoriesVisible() {
  const visible = useSyncExternalStore(subscribe, read, () => true);
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
