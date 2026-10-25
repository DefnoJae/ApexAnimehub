interface ArtworkImage {
  coverType?: string;
  url?: string;
  language?: string;
  languageCode?: string;
}
interface ArtworkPayload {
  mappings?: { anilist_id?: number; imdb_id?: string };
  images?: ArtworkImage[];
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
const imageHosts = new Set([
  "images.metahub.space",
  "artworks.thetvdb.com",
  "image.tmdb.org",
  "assets.fanart.tv",
]);
function safeImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      imageHosts.has(url.hostname)
    );
  } catch {
    return false;
  }
}
export function artworkLogos(
  data: ArtworkPayload,
  anilistId: number,
): string[] {
  if (Number(data.mappings?.anilist_id) !== anilistId) return [];
  const images = Array.isArray(data.images)
    ? data.images.filter(
        (image) =>
          image?.coverType?.toLowerCase() === "clearlogo" &&
          safeImage(image.url),
      )
    : [];
  const english = images
    .filter(
      (image) =>
        (image.languageCode || image.language || "").toLowerCase() === "en",
    )
    .map((image) => image.url!);
  const imdb = data.mappings?.imdb_id;
  // Metahub's default logos generally use English title treatments. The TVDB
  // clearlogo remains a fallback when that image is missing or unavailable.
  const metahub =
    typeof imdb === "string" && /^tt\d+$/.test(imdb)
      ? ["https://images.metahub.space/logo/medium/" + imdb + "/img"]
      : [];
  return Array.from(
    new Set([...english, ...metahub, ...images.map((image) => image.url!)]),
  );
}
export function artworkBackdrops(
  data: ArtworkPayload,
  anilistId: number,
): string[] {
  if (
    Number(data.mappings?.anilist_id) !== anilistId ||
    !Array.isArray(data.images)
  )
    return [];
  return Array.from(
    new Set(
      data.images
        .filter(
          (image) =>
            typeof image?.coverType === "string" &&
            ["fanart", "background", "backdrop"].includes(
              image.coverType.toLowerCase(),
            ) &&
            safeImage(image.url),
        )
        .map((image) => image.url!),
    ),
  );
}
export function isHeroBackdrop(width: number, height: number): boolean {
  return (
    width >= 1280 &&
    height >= 720 &&
    width / height >= 1.5 &&
    width / height <= 2.4
  );
}
async function fetchHeroMedia(anilistId: number): Promise<CachedArtwork> {
  const empty = { logos: [], backdrops: [], updatedAt: 0 };
  if (!Number.isSafeInteger(anilistId) || anilistId <= 0) return empty;
  const key = "apex_hero_artwork_v2_" + anilistId;
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
      (cached.logos.length || cached.backdrops.length ? 7 * DAY : DAY / 4)
  )
    return cached;
  const existing = pending.get(anilistId);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(
        "https://api.ani.zip/mappings?anilist_id=" + anilistId,
        { signal: controller.signal, credentials: "omit" },
      );
      if (!response.ok) throw new Error("Artwork unavailable");
      const data = await response.json();
      if (!data || Number(data.mappings?.anilist_id) !== anilistId)
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
