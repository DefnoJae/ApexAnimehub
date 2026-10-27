interface ArtworkPayload {
  anilistId?: number;
  logos?: string[];
  backdrops?: string[];
}
interface CachedArtwork {
  logos: string[];
  backdrops: string[];
  updatedAt: number;
}
const DAY = 86400000;
// Some provider records label square cover art as a clearlogo. Only accept
// wide title treatments; uncertain artwork keeps the readable text fallback.
export function isTitleTreatment(width: number, height: number): boolean {
  return (
    width >= 160 &&
    height >= 24 &&
    width / height >= 1.5 &&
    width / height <= 16
  );
}
const pending = new Map<number, Promise<CachedArtwork>>();
function safeImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https:\/\/image\.tmdb\.org\/t\/p\/(original|w1280|w500)\/[A-Za-z0-9_.-]+$/.test(
      value,
    )
  );
}
export function artworkLogos(data: ArtworkPayload, id: number): string[] {
  return data.anilistId === id && Array.isArray(data.logos)
    ? data.logos.filter(safeImage)
    : [];
}
export function artworkBackdrops(data: ArtworkPayload, id: number): string[] {
  return data.anilistId === id && Array.isArray(data.backdrops)
    ? data.backdrops.filter(safeImage)
    : [];
}
export function isHeroBackdrop(width: number, height: number): boolean {
  return (
    width >= 1280 &&
    height >= 720 &&
    width / height >= 1.5 &&
    width / height <= 2.4
  );
}
// AniList banners are intentionally panoramic, unlike full-height fanart.
// Keep them as a separate last resort instead of rejecting every thin banner.
export function isHeroBanner(width: number, height: number): boolean {
  return (
    width >= 960 &&
    height >= 300 &&
    width / height >= 1.5 &&
    width / height <= 6
  );
}
async function fetchHeroMedia(anilistId: number): Promise<CachedArtwork> {
  const empty = { logos: [], backdrops: [], updatedAt: 0 };
  if (!Number.isSafeInteger(anilistId) || anilistId <= 0) return empty;
  const key = "apex_tmdb_artwork_v2_" + anilistId;
  let cached: CachedArtwork | null = null;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (
      value &&
      Array.isArray(value.logos) &&
      value.logos.every(safeImage) &&
      Array.isArray(value.backdrops) &&
      value.backdrops.every(safeImage) &&
      Number.isFinite(value.updatedAt)
    )
      cached = value;
  } catch {}
  if (
    cached &&
    Date.now() - cached.updatedAt <
      (cached.logos.length || cached.backdrops.length ? DAY : DAY / 24)
  )
    return cached;
  const existing = pending.get(anilistId);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(
        "/api/artwork?anilist_id=" + anilistId + "&v=2",
        {
          signal: controller.signal,
          credentials: "omit",
        },
      );
      if (!response.ok) throw new Error("Artwork unavailable");
      const data = await response.json();
      if (!data || Number(data.anilistId) !== anilistId)
        throw new Error("Artwork ID mismatch");
      const logos = artworkLogos(data, anilistId);
      const result = {
        logos,
        backdrops: artworkBackdrops(data, anilistId),
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem(key, JSON.stringify(result));
      } catch {}
      return result;
    } catch {
      return cached || empty;
    } finally {
      clearTimeout(timer);
      pending.delete(anilistId);
    }
  })();
  pending.set(anilistId, request);
  return request;
}
export async function fetchHeroArtwork(anilistId: number): Promise<string[]> {
  return (await fetchHeroMedia(anilistId)).logos;
}
export async function fetchHeroBackdrops(anilistId: number): Promise<string[]> {
  return (await fetchHeroMedia(anilistId)).backdrops;
}
