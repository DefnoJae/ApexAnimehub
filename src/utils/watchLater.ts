const WATCH_LATER_KEY = "apex_watch_later_v1";

interface WatchLaterEntry {
  id: number;
  idMal?: number | null;
  title: { english?: string; romaji?: string };
  coverImage?: { extraLarge?: string };
  addedAt: number;
}

function readWatchLater(): WatchLaterEntry[] {
  try {
    const raw = localStorage.getItem(WATCH_LATER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWatchLater(entries: WatchLaterEntry[]): void {
  try {
    localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(entries));
  } catch {}
}

export function getWatchLater(): WatchLaterEntry[] {
  return readWatchLater();
}

export function isInWatchLater(anime: {
  id: number;
  idMal?: number | null;
}): boolean {
  const entries = readWatchLater();
  return entries.some((entry) =>
    (anime.id && entry.id && anime.id === entry.id) ||
    (anime.idMal && entry.idMal && anime.idMal === entry.idMal)
  );
}

export function toggleWatchLater(anime: {
  id: number;
  idMal?: number | null;
  title?: { english?: string; romaji?: string };
  coverImage?: { extraLarge?: string };
}): WatchLaterEntry[] {
  const entries = readWatchLater();
  const index = entries.findIndex((entry) =>
    (anime.id && entry.id && anime.id === entry.id) ||
    (anime.idMal && entry.idMal && anime.idMal === entry.idMal)
  );
  const next = index >= 0
    ? entries.filter((_, i) => i !== index)
    : [
        ...entries,
        {
          id: anime.id,
          idMal: anime.idMal ?? null,
          title: anime.title ?? {},
          coverImage: anime.coverImage,
          addedAt: Date.now(),
        },
      ];
  saveWatchLater(next);
  return next;
}

export function removeFromWatchLater(anime: {
  id: number;
  idMal?: number | null;
}): void {
  const entries = readWatchLater();
  const next = entries.filter(
    (entry) =>
      !(
        (anime.id && entry.id && anime.id === entry.id) ||
        (anime.idMal && entry.idMal && anime.idMal === entry.idMal)
      ),
  );
  if (next.length !== entries.length) {
    saveWatchLater(next);
  }
}
