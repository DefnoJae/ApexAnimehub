export interface PlaybackProgress {
  position?: number;
  duration?: number;
}
const KEY = "apex_episode_progress_v1";
export function resumeSeconds(value?: PlaybackProgress): number {
  const position = value?.position,
    duration = value?.duration;
  return typeof position === "number" &&
    Number.isFinite(position) &&
    position >= 3 &&
    typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > 0 &&
    position < duration * 0.98 &&
    position < duration - 5
    ? position
    : 0;
}
export function readEpisodeProgress(
  id: number,
  episode: number,
): PlaybackProgress | undefined {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}")[id + ":" + episode];
  } catch {
    return undefined;
  }
}
export function saveEpisodeProgress(
  id: number,
  episode: number,
  position: number,
  duration: number,
) {
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(episode) ||
    episode <= 0 ||
    !Number.isFinite(position) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    position < 0 ||
    position > duration + 5
  )
    return;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    saved[id + ":" + episode] = {
      position: Math.min(position, duration),
      duration,
      updated: Date.now(),
    };
    const entries = Object.entries(saved) as Array<
      [string, { updated?: number }]
    >;
    entries.sort((a, b) => (b[1]?.updated || 0) - (a[1]?.updated || 0));
    localStorage.setItem(
      KEY,
      JSON.stringify(Object.fromEntries(entries.slice(0, 300))),
    );
  } catch {}
}
export function playbackTime(seconds: number): string {
  const n = Math.floor(seconds);
  return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
}
