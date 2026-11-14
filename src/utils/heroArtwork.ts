interface ArtworkPayload {
  anilistId?: number;
  logos?: string[];
  backdrops?: string[];
}
interface CachedArtwork {
  logos: string[];
  backdrops: string[];
  updatedAt: number;
  match?: string;
}
const DAY = 21600000;
// TMDB assets come from its verified logos collection. Square title marks
// (for example 18if) are valid logos too, not automatically poster artwork.
export function isTitleTreatment(width: number, height: number): boolean {
  return width >= 32 && height >= 12;
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
function safeLogo(value: unknown): value is string {
  return safeImage(value) || value === "/title-logos/steel-ball-run.png";
}
export function artworkLogos(data: ArtworkPayload, id: number): string[] {
  return data.anilistId === id && Array.isArray(data.logos)
    ? data.logos.filter(safeLogo)
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
  const backup = window.location.hostname === "apexanime.pages.dev";
  const key = (backup ? "apex_tmdb_artwork_v9_" : "apex_tmdb_artwork_v8_") + anilistId;
  let freshCache = false;
  let cached: CachedArtwork | null = null;
  try {
    const current = localStorage.getItem(key);
    freshCache = current !== null;
    // Revalidate the previous resolver's cache, but keep verified images usable
    // if the provider is temporarily unavailable during migration.
    const value = JSON.parse(
      current ||
        localStorage.getItem((backup ? "apex_tmdb_artwork_v8_" : "apex_tmdb_artwork_v7_") + anilistId) ||
        "null",
    );
    if (
      value &&
      (freshCache || backup || (value.match === "exact" && value.logos?.length)) &&
      Array.isArray(value.logos) &&
      value.logos.every(safeLogo) &&
      Array.isArray(value.backdrops) &&
      value.backdrops.every(safeImage) &&
      Number.isFinite(value.updatedAt)
    )
      cached = value;
  } catch {}
  if (
    freshCache &&
    cached &&
    Date.now() - cached.updatedAt <
      (cached.match === "exact" &&
      cached.logos.length &&
      cached.backdrops.length
        ? DAY
        : 900000)
  )
    return cached;
  const existing = pending.get(anilistId);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 45000);
    try {
      const path = "/api/artwork?anilist_id=" + anilistId + "&v=8";
      const read = async (url: string) => {
        const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
        if (!response.ok) throw new Error("Artwork unavailable");
        const data = await response.json();
        if (!data || Number(data.anilistId) !== anilistId)
          throw new Error("Artwork ID mismatch");
        return data;
      };
      let data = await read(path).catch((error) => {
        if (!backup) throw error;
        return null;
      });
      if (backup && (!data || !artworkLogos(data, anilistId).length || !artworkBackdrops(data, anilistId).length)) {
        const primary = await read("https://apexanime.vercel.app" + path).catch(() => null);
        if (primary) {
          data = {
            ...primary,
            logos: artworkLogos(primary, anilistId).length ? primary.logos : data?.logos,
            backdrops: artworkBackdrops(primary, anilistId).length ? primary.backdrops : data?.backdrops,
          };
        }
      }
      if (!data) throw new Error("Artwork unavailable");
      const logos = artworkLogos(data, anilistId);
      if (
        !logos.length &&
        data.match === "none" &&
        cached?.match === "exact" &&
        cached.logos.length
      )
        return cached;
      const result = {
        logos,
        backdrops: artworkBackdrops(data, anilistId),
        updatedAt: Date.now(),
        match: data.match === "exact" ? "exact" : "fallback",
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
