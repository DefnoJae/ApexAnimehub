import { fetchAnilist } from "./anilist";
import type { DashboardAnime } from "../components/HomeDashboard";
import type { ListAnime } from "../hooks/useAccounts";
import { sameAnime } from "../hooks/useLibrary";

export const HOME_ROW_LIMIT = 30;
export interface HomeRow {
  title: string;
  animes: DashboardAnime[];
  notice?: string;
}
interface CatalogAnime extends DashboardAnime {
  type?: string;
  isAdult?: boolean;
  format?: string;
  status?: string;
}
interface RelatedAnime extends CatalogAnime {
  relations?: { edges: Array<{ relationType: string; node: CatalogAnime }> };
}
const fields = `id idMal type isAdult title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore nextAiringEpisode { episode }`;
export function animeSeasons(date: Date) {
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const index = Math.floor(date.getUTCMonth() / 3),
    year = date.getUTCFullYear();
  return {
    season: seasons[index],
    year,
    previousSeason: seasons[(index + 3) % 4],
    previousYear: index === 0 ? year - 1 : year,
  };
}
const uniqueAnime = (items: CatalogAnime[]) =>
  Array.from(
    new Map(
      items
        .filter((item) => item?.id && !item.isAdult)
        .map((item) => [item.id, item]),
    ).values(),
  );
export async function fetchRecentlyAired(
  date: Date,
  signal?: AbortSignal,
): Promise<DashboardAnime[]> {
  const now = Math.floor(date.getTime() / 1000),
    since = now - 30 * 86400;
  const found = new Map<number, CatalogAnime>();
  for (let page = 1; ; page++) {
    const data = await fetchAnilist<{
      Page: {
        pageInfo: { hasNextPage: boolean };
        airingSchedules: Array<{ media: CatalogAnime }>;
      };
    }>(
      `query RecentlyAired($page:Int,$now:Int,$since:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_lesser:$now,airingAt_greater:$since,sort:TIME_DESC){media{${fields}}}}}`,
      { page, now, since },
      signal,
    );
    for (const item of data.Page.airingSchedules) {
      if (item.media?.id && !item.media.isAdult && !found.has(item.media.id))
        found.set(item.media.id, item.media);
      if (found.size >= HOME_ROW_LIMIT) return Array.from(found.values());
    }
    if (!data.Page.pageInfo.hasNextPage || !data.Page.airingSchedules.length)
      return Array.from(found.values());
  }
}
export async function fetchHomeCatalog(
  date = new Date(),
  signal?: AbortSignal,
) {
  const seasons = animeSeasons(date);
  const [catalog, recent] = await Promise.allSettled([
    fetchAnilist<{
      trending: { media: CatalogAnime[] };
      current: { media: CatalogAnime[] };
      previous: { media: CatalogAnime[] };
    }>(
      `query HomeCatalog($season:MediaSeason,$year:Int,$previousSeason:MediaSeason,$previousYear:Int){
        trending:Page(page:1,perPage:30){media(type:ANIME,isAdult:false,sort:TRENDING_DESC){${fields}}}
        current:Page(page:1,perPage:30){media(type:ANIME,isAdult:false,season:$season,seasonYear:$year,status_not:NOT_YET_RELEASED,sort:[SCORE_DESC,POPULARITY_DESC]){${fields}}}
        previous:Page(page:1,perPage:30){media(type:ANIME,isAdult:false,season:$previousSeason,seasonYear:$previousYear,status_not:NOT_YET_RELEASED,sort:[SCORE_DESC,POPULARITY_DESC]){${fields}}}
      }`,
      seasons,
      signal,
    ),
    fetchRecentlyAired(date, signal),
  ]);
  if (catalog.status === "rejected") throw catalog.reason;
  const trending = uniqueAnime(catalog.value.trending.media).slice(
    0,
    HOME_ROW_LIMIT,
  );
  const rows: HomeRow[] = [
    { title: "Trending Now", animes: trending },
    {
      title: "Recently Aired",
      animes: recent.status === "fulfilled" ? recent.value : [],
      notice:
        recent.status === "rejected"
          ? "Recent releases could not be loaded. Refresh to try again."
          : recent.value.length
            ? undefined
            : "No anime releases found in the last 30 days.",
    },
    {
      title: "Best of This Season",
      animes: uniqueAnime(catalog.value.current.media).slice(0, HOME_ROW_LIMIT),
    },
    {
      title: "Best of Last Season",
      animes: uniqueAnime(catalog.value.previous.media).slice(
        0,
        HOME_ROW_LIMIT,
      ),
    },
  ];
  return { trending, rows };
}

const relationTypes = new Set([
  "SEQUEL",
  "PREQUEL",
  "SIDE_STORY",
  "SPIN_OFF",
  "PARENT",
  "ALTERNATIVE",
  "SUMMARY",
]);
const relationCache = new Map<
  string,
  { time: number; media: RelatedAnime | null }
>();
type Seed = { id: number; idMal?: number | null };
const seedKey = (item: Seed) =>
  item.id > 0 ? `al:${item.id}` : `mal:${item.idMal}`;
export function libraryIdentity(animes: ListAnime[]) {
  return Array.from(
    new Set(animes.map((anime) => `${anime.id || 0}:${anime.idMal || 0}`)),
  )
    .sort()
    .join(",");
}
// Walk the actual franchise relations, including missing intermediates. Never fill
// this personal row with unrelated titles merely to reach thirty results.
export async function fetchMissingLibrary(
  animes: ListAnime[],
  signal: AbortSignal,
): Promise<{ animes: DashboardAnime[]; error?: string }> {
  const owned = animes;
  const queue: Seed[] = [],
    queued = new Set<string>();
  const matches = new Map<number, CatalogAnime>();
  const enqueue = (item: Seed) => {
    if (
      !(Number.isSafeInteger(item.id) && item.id > 0) &&
      !(Number.isSafeInteger(item.idMal) && Number(item.idMal) > 0)
    )
      return;
    const key = seedKey(item);
    if (!queued.has(key)) {
      queued.add(key);
      queue.push(item);
    }
  };
  // Avoid resolving MAL entries twice when AniList already supplies their mapping.
  const mappedMal = new Set(
    animes
      .filter((item) => item.id > 0 && item.idMal)
      .map((item) => item.idMal),
  );
  animes
    .filter((item) => item.id > 0 || !mappedMal.has(item.idMal))
    .forEach(enqueue);
  while (queue.length && matches.size < HOME_ROW_LIMIT) {
    if (signal.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    const batch = queue.splice(0, 15);
    const missing = batch.filter((item) => {
      const saved = relationCache.get(seedKey(item));
      return !saved || Date.now() - saved.time > 30 * 60 * 1000;
    });
    if (missing.length) {
      try {
        // Aliases support both AniList IDs and MAL-only libraries without guessing IDs.
        const query = `query MissingLibrary { ${missing.map((item, index) => `n${index}:Media(${item.id > 0 ? `id:${item.id}` : `idMal:${item.idMal}`},type:ANIME){${fields} relations{edges{relationType node{${fields} format status}}}}`).join(" ")} }`;
        const data = await fetchAnilist<Record<string, RelatedAnime | null>>(
          query,
          {},
          signal,
        );
        missing.forEach((item, index) => {
          const media = data[`n${index}`];
          if (relationCache.size >= 1000)
            relationCache.delete(relationCache.keys().next().value as string);
          relationCache.set(seedKey(item), { time: Date.now(), media });
          if (media)
            relationCache.set(`al:${media.id}`, { time: Date.now(), media });
        });
      } catch (error) {
        if (signal.aborted) throw error;
        return {
          animes: Array.from(matches.values()),
          error:
            error instanceof Error
              ? error.message
              : "Missing titles could not be loaded.",
        };
      }
    }
    for (const item of batch) {
      const media = relationCache.get(seedKey(item))?.media;
      if (!media) continue;
      queued.add(`al:${media.id}`);
      for (const edge of media.relations?.edges || []) {
        const node = edge.node;
        if (
          !relationTypes.has(edge.relationType) ||
          node?.type !== "ANIME" ||
          node.isAdult
        )
          continue;
        enqueue(node);
        if (!owned.some((anime) => sameAnime(anime, node)))
          matches.set(node.id, node);
        if (matches.size >= HOME_ROW_LIMIT) break;
      }
      if (matches.size >= HOME_ROW_LIMIT) break;
    }
  }
  return { animes: Array.from(matches.values()) };
}

export function pickHeroSlides<T extends { id: number }>(
  trending: T[],
  limit = 10,
  random = Math.random,
): T[] {
  const pool = Array.from(
    new Map(
      trending.filter((item) => item.id > 0).map((item) => [item.id, item]),
    ).values(),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}
