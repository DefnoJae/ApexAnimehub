import { getDubIndex } from "./animeMetadata";
import { fetchAnilist } from "./anilist";
import type { DashboardAnime } from "../components/HomeDashboard";
export interface DiscoveryFilters {
  search: string;
  genres: string[];
  from: string;
  to: string;
  season: string;
  score: string;
  audio: string;
  status: string;
  format: string;
  sort: string;
}
export const defaultFilters: DiscoveryFilters = {
  search: "",
  genres: [],
  from: "",
  to: "",
  season: "",
  score: "0",
  audio: "any",
  status: "",
  format: "",
  sort: "popularity",
};
export interface DiscoveryAnime extends DashboardAnime {
  malScore: number | null;
  anilistScore?: number | null;
  year?: number;
  format?: string;
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
    "query($page:Int,$search:String,$genres:[String],$after:FuzzyDateInt,$before:FuzzyDateInt,$season:MediaSeason,$score:Int,$status:MediaStatus,$format:MediaFormat,$sort:[MediaSort]){Page(page:$page,perPage:48){pageInfo{hasNextPage} media(type:ANIME,isAdult:false,search:$search,genre_in:$genres,startDate_greater:$after,startDate_lesser:$before,season:$season,averageScore_greater:$score,status:$status,format:$format,sort:$sort){id idMal title{english romaji} coverImage{extraLarge} bannerImage episodes averageScore startDate{year} format}}}",
    {
      page,
      search: filters.search.trim() || undefined,
      genres: selectedGenres.length ? selectedGenres : undefined,
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
export async function fetchDiscovery(
  filters: DiscoveryFilters,
  page: number,
  signal: AbortSignal,
  preferred: "mal" | "anilist" = "mal",
) {
  if (filters.from && filters.to && Number(filters.from) > Number(filters.to))
    throw new Error("Start year must be before or equal to end year.");
  if (
    preferred === "anilist" ||
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
