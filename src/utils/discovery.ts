import { getDubIndex } from "./animeMetadata";
import { fetchAnilist } from "./anilist";
import type { DashboardAnime } from "../components/HomeDashboard";
import { sameAnime } from "../hooks/useLibrary";
import type { LibraryEntry } from "../hooks/useLibrary";
export function matchesListStatus(
  anime: DashboardAnime,
  entries: LibraryEntry[],
  status?: string,
): boolean {
  if (!status) return true;
  const matches = entries.filter((entry) => sameAnime(entry.anime, anime));
  return status === "not-listed"
    ? matches.length === 0
    : matches.some((entry) => entry.status === status);
}
export interface DiscoveryFilters {
  search: string;
  genres: string[];
  tags?: string[];
  from: string;
  to: string;
  season: string;
  score: string;
  audio: string;
  status: string;
  format: string;
  sort: string;
  listStatus?: string;
  studioId?: number;
}
export const defaultFilters: DiscoveryFilters = {
  search: "",
  genres: [],
  tags: [],
  from: "",
  to: "",
  season: "",
  score: "0",
  audio: "any",
  status: "",
  format: "",
  sort: "popularity",
  listStatus: "",
};
export interface DiscoveryAnime extends DashboardAnime {
  malScore: number | null;
  anilistScore?: number | null;
  year?: number;
  format?: string;
}
interface DiscoveryResult {
  items: DiscoveryAnime[];
  nextPage: number | null;
  scanned: number;
  source: "mal" | "anilist";
}
interface DiscoveryOptions {
  genres: string[];
  tags: string[];
}
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const PAGE_CACHE_TTL = 600_000;
const OPTIONS_CACHE_TTL = 1_800_000;
const PAGE_CACHE_MAX = 24;
const OPTIONS_CACHE_MAX = 8;
const pageCache = new Map<string, CacheEntry<DiscoveryResult>>();
const optionsCache = new Map<string, CacheEntry<DiscoveryOptions>>();
function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  signal: AbortSignal,
): T | null {
  if (signal.aborted) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttl: number,
  max: number,
) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > max) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
function copyResult(result: DiscoveryResult): DiscoveryResult {
  return { ...result, items: [...result.items] };
}
function copyOptions(options: DiscoveryOptions): DiscoveryOptions {
  return { genres: [...options.genres], tags: [...options.tags] };
}
interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string;
  images?: {
    webp?: { large_image_url?: string };
    jpg?: { large_image_url?: string };
  };
  score: number | null;
  episodes?: number;
  year?: number;
  type?: string;
  season?: string;
}
export function discoveryParams(filters: DiscoveryFilters, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "24",
    sfw: "true",
    order_by: filters.sort,
    sort: ["popularity", "title"].includes(filters.sort) ? "asc" : "desc",
  });
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.genres.length) params.set("genres", filters.genres.join(","));
  if (filters.from) params.set("start_date", filters.from + "-01-01");
  if (filters.to) params.set("end_date", filters.to + "-12-31");
  if (Number(filters.score) > 0) params.set("min_score", filters.score);
  if (filters.status) params.set("status", filters.status);
  if (filters.format) params.set("type", filters.format);
  return params;
}
class CatalogUnavailable extends Error {}
let unavailableUntil = 0;
const genreNames = new Map<string, string>();
async function request(path: string, signal: AbortSignal) {
  if (Date.now() < unavailableUntil)
    throw new CatalogUnavailable("MAL catalog unavailable");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 6000);
  let response: Response;
  try {
    response = await fetch("https://api.jikan.moe/v4/" + path, {
      signal: controller.signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    unavailableUntil = Date.now() + 60000;
    throw new CatalogUnavailable("MAL catalog unavailable");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Discovery is rate limited. Wait a minute, then retry."
        : "Discovery provider unavailable (" +
          response.status +
          "). Please retry.",
    );
  return response.json();
}
async function fetchMalDiscovery(
  filters: DiscoveryFilters,
  firstPage: number,
  signal: AbortSignal,
) {
  if (filters.from && filters.to && Number(filters.from) > Number(filters.to))
    throw new Error("Start year must be before or equal to end year.");
  const dub = filters.audio === "dub" ? await getDubIndex() : null;
  if (signal.aborted) throw new Error("Cancelled");
  const dubbed = new Set([...(dub?.dubbed || []), ...(dub?.partial || [])]);
  const items: DiscoveryAnime[] = [];
  let page = firstPage,
    more = false,
    scanned = 0;
  // Bounded scanning avoids an unending request chain when filters are narrow.
  do {
    const payload = await request(
      "anime?" + discoveryParams(filters, page),
      signal,
    );
    if (!Array.isArray(payload.data))
      throw new Error("Discovery returned an invalid response.");
    payload.data.forEach((anime: JikanAnime) => {
      if (
        !anime.mal_id ||
        (filters.audio === "dub" && !dubbed.has(anime.mal_id)) ||
        (filters.season && anime.season !== filters.season)
      )
        return;
      items.push({
        id: 0,
        idMal: anime.mal_id,
        title: { english: anime.title_english || anime.title },
        coverImage: {
          extraLarge:
            anime.images?.webp?.large_image_url ||
            anime.images?.jpg?.large_image_url,
        },
        episodes: anime.episodes,
        malScore: anime.score,
        year: anime.year,
        format: anime.type,
      });
    });
    more = !!payload.pagination?.has_next_page;
    scanned++;
    page++;
    if (
      !more ||
      items.length >= 24 ||
      scanned >= 4 ||
      (!filters.season && filters.audio !== "dub")
    )
      break;
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new Error("Cancelled"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 1200);
      signal.addEventListener("abort", abort, { once: true });
    });
  } while (!signal.aborted);
  return {
    items: Array.from(
      new Map(items.map((item) => [item.idMal, item])).values(),
    ),
    nextPage: more ? page : null,
    scanned,
    source: "mal" as const,
  };
}
async function fetchAniDiscovery(
  filters: DiscoveryFilters,
  page: number,
  signal: AbortSignal,
) {
  const selectedGenres = filters.genres.map((id) =>
    id.startsWith("name:") ? id.slice(5) : genreNames.get(id),
  );
  if (selectedGenres.some((name) => !name))
    throw new Error(
      "Saved genre choices are unavailable in this catalog. Reset genres and select them again.",
    );
  const dub = filters.audio === "dub" ? await getDubIndex() : null;
  const dubbed = new Set([...(dub?.dubbed || []), ...(dub?.partial || [])]);
  const sort =
    {
      trending: "TRENDING_DESC",
      popularity: "POPULARITY_DESC",
      score: "SCORE_DESC",
      start_date: "START_DATE_DESC",
      title: "TITLE_ROMAJI",
    }[filters.sort] || "POPULARITY_DESC";
  interface AniMedia extends DashboardAnime {
    averageScore?: number;
    startDate?: { year?: number };
    format?: string;
  }
  const data = await fetchAnilist<{
    Page: { pageInfo: { hasNextPage: boolean }; media: AniMedia[] };
  }>(
    "query($page:Int,$search:String,$genres:[String],$tags:[String],$after:FuzzyDateInt,$before:FuzzyDateInt,$season:MediaSeason,$score:Int,$status:MediaStatus,$format:MediaFormat,$sort:[MediaSort]){Page(page:$page,perPage:50){pageInfo{hasNextPage} media(type:ANIME,isAdult:false,search:$search,genre_in:$genres,tag_in:$tags,startDate_greater:$after,startDate_lesser:$before,season:$season,averageScore_greater:$score,status:$status,format:$format,sort:$sort){id idMal title{english romaji} coverImage{extraLarge} bannerImage episodes averageScore startDate{year} format}}}",
    {
      page,
      search: filters.search.trim() || undefined,
      genres: selectedGenres.length ? selectedGenres : undefined,
      tags: filters.tags?.length ? filters.tags : undefined,
      after: filters.from ? Number(filters.from) * 10000 + 100 : undefined,
      before: filters.to ? (Number(filters.to) + 1) * 10000 + 101 : undefined,
      season: filters.season ? filters.season.toUpperCase() : undefined,
      score:
        Number(filters.score) > 0 ? Number(filters.score) * 10 - 1 : undefined,
      status: {
        airing: "RELEASING",
        complete: "FINISHED",
        upcoming: "NOT_YET_RELEASED",
      }[filters.status],
      format: filters.format ? filters.format.toUpperCase() : undefined,
      sort: [sort],
    },
    signal,
  );
  return {
    items: data.Page.media
      .filter(
        (anime) =>
          filters.audio !== "dub" || (!!anime.idMal && dubbed.has(anime.idMal)),
      )
      .map((anime) => ({
        ...anime,
        malScore: null,
        anilistScore: anime.averageScore ? anime.averageScore / 10 : null,
        year: anime.startDate?.year,
        format: anime.format,
      })),
    nextPage: data.Page.pageInfo.hasNextPage ? page + 1 : null,
    scanned: 1,
    source: "anilist" as const,
  };
}
interface StudioMedia extends DiscoveryAnime {
  type?: string;
  isAdult?: boolean;
  averageScore?: number;
  startDate?: { year?: number };
  season?: string;
  status?: string;
  genres?: string[];
  tags?: Array<{ name: string }>;
}
export function matchesStudioFilters(
  anime: StudioMedia,
  filters: DiscoveryFilters,
) {
  const year = anime.startDate?.year;
  const title = [anime.title.english, anime.title.romaji]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    anime.type === "ANIME" &&
    !anime.isAdult &&
    (!filters.search.trim() ||
      title.includes(filters.search.trim().toLowerCase())) &&
    (!filters.from || (!!year && year >= Number(filters.from))) &&
    (!filters.to || (!!year && year <= Number(filters.to))) &&
    (!filters.season || anime.season === filters.season.toUpperCase()) &&
    (!filters.format || anime.format === filters.format.toUpperCase()) &&
    (!filters.status ||
      anime.status ===
        {
          airing: "RELEASING",
          complete: "FINISHED",
          upcoming: "NOT_YET_RELEASED",
        }[filters.status]) &&
    (!Number(filters.score) ||
      (anime.averageScore || 0) >= Number(filters.score) * 10) &&
    filters.genres.every((id) =>
      anime.genres?.includes(
        id.startsWith("name:") ? id.slice(5) : genreNames.get(id) || "",
      ),
    ) &&
    (filters.tags || []).every((tag) =>
      anime.tags?.some((item) => item.name === tag),
    )
  );
}
async function fetchStudioDiscovery(
  filters: DiscoveryFilters,
  page: number,
  signal: AbortSignal,
) {
  const sort =
    {
      trending: "TRENDING_DESC",
      popularity: "POPULARITY_DESC",
      score: "SCORE_DESC",
      start_date: "START_DATE_DESC",
      title: "TITLE_ROMAJI",
    }[filters.sort] || "POPULARITY_DESC";
  const dub = filters.audio === "dub" ? await getDubIndex() : null;
  const dubbed = new Set([...(dub?.dubbed || []), ...(dub?.partial || [])]);
  const data = await fetchAnilist<{
    Studio: {
      name: string;
      media: { pageInfo: { hasNextPage: boolean }; nodes: StudioMedia[] };
    } | null;
  }>(
    "query($id:Int!,$page:Int!,$sort:[MediaSort]){Studio(id:$id){name media(page:$page,perPage:50,sort:$sort){pageInfo{hasNextPage} nodes{id idMal type isAdult title{english romaji} coverImage{extraLarge} bannerImage episodes averageScore startDate{year} season status format genres tags{name}}}}}",
    { id: filters.studioId, page, sort: [sort] },
    signal,
  );
  if (!data.Studio)
    throw new Error(
      "This studio is unavailable. Remove the studio filter and try again.",
    );
  const items = data.Studio.media.nodes
    .filter(
      (anime) =>
        matchesStudioFilters(anime, filters) &&
        (filters.audio !== "dub" || (!!anime.idMal && dubbed.has(anime.idMal))),
    )
    .map((anime) => ({
      ...anime,
      malScore: null,
      anilistScore: anime.averageScore ? anime.averageScore / 10 : null,
      year: anime.startDate?.year,
    }));
  return {
    items,
    nextPage: data.Studio.media.pageInfo.hasNextPage ? page + 1 : null,
    scanned: 1,
    source: "anilist" as const,
  };
}
async function fetchDiscoveryUncached(
  filters: DiscoveryFilters,
  page: number,
  signal: AbortSignal,
  preferred: "mal" | "anilist" = "mal",
): Promise<DiscoveryResult> {
  if (filters.from && filters.to && Number(filters.from) > Number(filters.to))
    throw new Error("Start year must be before or equal to end year.");
  if (filters.studioId) return fetchStudioDiscovery(filters, page, signal);
  if (
    preferred === "anilist" ||
    filters.tags?.length ||
    filters.genres.some((id) => id.startsWith("name:"))
  )
    return fetchAniDiscovery(filters, page, signal);
  try {
    return await fetchMalDiscovery(filters, page, signal);
  } catch (error) {
    if (!(error instanceof CatalogUnavailable) || signal.aborted) throw error;
    return fetchAniDiscovery(filters, 1, signal);
  }
}
export async function fetchDiscovery(
  filters: DiscoveryFilters,
  page: number,
  signal: AbortSignal,
  preferred: "mal" | "anilist" = "mal",
): Promise<DiscoveryResult> {
  if (filters.from && filters.to && Number(filters.from) > Number(filters.to))
    throw new Error("Start year must be before or equal to end year.");
  const key = preferred + ":" + JSON.stringify(filters) + ":" + page;
  const cached = readCache(pageCache, key, signal);
  if (cached) return copyResult(cached);
  const result = await fetchDiscoveryUncached(filters, page, signal, preferred);
  if (!signal.aborted)
    writeCache(pageCache, key, copyResult(result), PAGE_CACHE_TTL, PAGE_CACHE_MAX);
  return result;
}
export async function fetchGenres(
  signal: AbortSignal,
): Promise<Array<{ mal_id: number | string; name: string }>> {
  try {
    const data = await request("genres/anime?filter=genres", signal);
    if (!Array.isArray(data.data)) throw new Error("Genres unavailable");
    data.data.forEach((genre: { mal_id: number; name: string }) =>
      genreNames.set(String(genre.mal_id), genre.name),
    );
    return data.data;
  } catch (error) {
    if (signal.aborted) throw error;
    const data = await fetchAnilist<{ GenreCollection: string[] }>(
      "query{GenreCollection}",
      {},
      signal,
    );
    return data.GenreCollection.map((name) => ({
      mal_id: "name:" + name,
      name,
    }));
  }
}

export async function fetchDiscoveryOptions(
  signal: AbortSignal,
): Promise<DiscoveryOptions> {
  const cached = readCache(optionsCache, "options", signal);
  if (cached) return copyOptions(cached);
  const data = await fetchAnilist<{
    GenreCollection: string[];
    MediaTagCollection: Array<{ name: string; isAdult: boolean }>;
  }>("query{GenreCollection MediaTagCollection{name isAdult}}", {}, signal);
  const result = {
    genres: data.GenreCollection,
    tags: data.MediaTagCollection.filter((tag) => !tag.isAdult)
      .map((tag) => tag.name)
      .sort(),
  };
  if (!signal.aborted)
    writeCache(
      optionsCache,
      "options",
      copyOptions(result),
      OPTIONS_CACHE_TTL,
      OPTIONS_CACHE_MAX,
    );
  return result;
}
