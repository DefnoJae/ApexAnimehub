import { fetchAnilist } from "./anilist";
import { fetchDubRange } from "./dubSchedule";
import type { DashboardAnime } from "../components/HomeDashboard";
import type { LibraryEntry } from "../hooks/useLibrary";
import { sameAnime } from "../hooks/useLibrary";
export type ScheduleLanguage = "all" | "sub" | "dub";
export interface CalendarAnime extends DashboardAnime {
  format?: string;
  isAdult?: boolean;
}
export interface CalendarRelease {
  key: string;
  anime: CalendarAnime;
  episode: number;
  at: number;
  language: "sub" | "dub";
  note?: string;
}
export interface CalendarResult {
  entries: CalendarRelease[];
  updatedAt: number | null;
  warnings: string[];
}
export interface CalendarPreferences {
  language: ScheduleLanguage;
  scope: "discover" | "yours";
  format: string;
  sort: "time" | "latest" | "title";
}
export const defaultCalendarPreferences: CalendarPreferences = {
  language: "all",
  scope: "discover",
  format: "all",
  sort: "time",
};
export function readCalendarPreferences(): CalendarPreferences {
  try {
    const data = JSON.parse(
      localStorage.getItem("apex_calendar_preferences_v1") || "null",
    );
    if (!data) return defaultCalendarPreferences;
    return {
      language: ["all", "sub", "dub"].includes(data.language)
        ? data.language
        : "all",
      scope: data.scope === "yours" ? "yours" : "discover",
      format: ["TV", "TV_SHORT", "ONA", "MOVIE", "OVA", "SPECIAL"].includes(
        data.format,
      )
        ? data.format
        : "all",
      sort: ["latest", "title"].includes(data.sort) ? data.sort : "time",
    };
  } catch {
    return defaultCalendarPreferences;
  }
}
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function sundayWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}
export function monthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = sundayWeek(first).start;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const end = sundayWeek(last).end;
  const days: Date[] = [];
  for (
    const cursor = new Date(start);
    cursor < end;
    cursor.setDate(cursor.getDate() + 1)
  )
    days.push(new Date(cursor));
  return { start, end, days };
}
export function filterCalendar(
  entries: CalendarRelease[],
  preferences: CalendarPreferences,
  query: string,
  library: LibraryEntry[],
) {
  const needle = query.trim().toLocaleLowerCase();
  return entries
    .filter(
      (entry) =>
        (preferences.language === "all" ||
          entry.language === preferences.language) &&
        (preferences.format === "all" ||
          entry.anime.format === preferences.format) &&
        (preferences.scope === "discover" ||
          library.some((item) => sameAnime(item.anime, entry.anime))) &&
        (!needle ||
          [entry.anime.title.english, entry.anime.title.romaji].some((title) =>
            title?.toLocaleLowerCase().includes(needle),
          )),
    )
    .sort((a, b) =>
      preferences.sort === "title"
        ? (a.anime.title.english || a.anime.title.romaji || "").localeCompare(
            b.anime.title.english || b.anime.title.romaji || "",
          ) || a.at - b.at
        : preferences.sort === "latest"
          ? b.at - a.at
          : a.at - b.at,
    );
}
const fields =
  "id idMal title{english romaji} bannerImage coverImage{extraLarge} format episodes isAdult";
const subCache = new Map<
  string,
  { entries: CalendarRelease[]; updatedAt: number }
>();
const metadataCache = new Map<string, { anime: CalendarAnime; at: number }>();
function rememberAnime(anime: CalendarAnime) {
  if (metadataCache.size > 2000) metadataCache.clear();
  const value = { anime, at: Date.now() };
  if (anime.id) metadataCache.set("al:" + anime.id, value);
  if (anime.idMal) metadataCache.set("mal:" + anime.idMal, value);
}
function cachedAnime(anime: CalendarAnime) {
  const value = metadataCache.get(
    anime.id ? "al:" + anime.id : "mal:" + anime.idMal,
  );
  return value && Date.now() - value.at < 21600000 ? value.anime : undefined;
}
function readSubCache(key: string) {
  try {
    const values = JSON.parse(
      localStorage.getItem("apex_calendar_sub_cache_v1") || "[]",
    );
    const saved = Array.isArray(values)
      ? values.find((value) => value?.key === key)
      : null;
    if (
      saved &&
      Number.isFinite(saved.updatedAt) &&
      saved.updatedAt <= Date.now() + 60000 &&
      Array.isArray(saved.entries) &&
      saved.entries.length <= 3000 &&
      saved.entries.every(
        (entry: CalendarRelease) =>
          entry?.language === "sub" &&
          Number.isFinite(entry.at) &&
          entry.episode > 0 &&
          entry.anime?.id > 0 &&
          entry.anime.title &&
          typeof entry.key === "string",
      )
    ) {
      for (const entry of saved.entries) rememberAnime(entry.anime);
      return {
        entries: saved.entries as CalendarRelease[],
        updatedAt: saved.updatedAt as number,
      };
    }
  } catch {}
  return undefined;
}
async function subRange(
  start: Date,
  end: Date,
  signal: AbortSignal,
  force: boolean,
) {
  const key = dateKey(start) + ":" + dateKey(end);
  const saved = subCache.get(key) || readSubCache(key);
  if (!force && saved && Date.now() - saved.updatedAt < 600000)
    return { ...saved, warning: "" };
  const entries: CalendarRelease[] = [];
  try {
    let page = 1,
      more = true;
    while (more) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const data = await fetchAnilist<{
        Page: {
          pageInfo: { hasNextPage: boolean };
          airingSchedules: Array<{
            id: number;
            episode: number;
            airingAt: number;
            media: CalendarAnime;
          }>;
        };
      }>(
        `query CalendarSchedule($page:Int,$since:Int,$until:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$since,airingAt_lesser:$until,sort:TIME){id episode airingAt media{${fields}}}}}`,
        {
          page,
          since: Math.floor(+start / 1000) - 1,
          until: Math.floor(+end / 1000),
        },
        signal,
      );
      for (const item of data.Page.airingSchedules) {
        if (item.media?.id) rememberAnime(item.media);
        if (
          item.media?.id &&
          !item.media.isAdult &&
          item.episode > 0 &&
          Number.isFinite(item.airingAt)
        )
          entries.push({
            key: `sub:${item.id}`,
            anime: item.media,
            episode: item.episode,
            at: item.airingAt * 1000,
            language: "sub",
          });
      }
      more = data.Page.pageInfo.hasNextPage;
      if (more && page >= 60)
        throw new Error("The schedule is too large to load completely.");
      page++;
    }
    const value = { entries, updatedAt: Date.now() };
    if (subCache.size >= 8) subCache.delete(subCache.keys().next().value!);
    subCache.set(key, value);
    try {
      localStorage.setItem(
        "apex_calendar_sub_cache_v1",
        JSON.stringify(
          Array.from(subCache.entries())
            .slice(-4)
            .map(([key, value]) => ({ key, ...value })),
        ),
      );
    } catch {}
    return { ...value, warning: "" };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      entries: saved?.entries || entries,
      updatedAt: saved?.updatedAt || null,
      warning:
        "Sub schedule could not be fully refreshed." +
        (saved ? " Showing cached releases." : " Please retry."),
    };
  }
}
async function dubRange(
  start: Date,
  end: Date,
  signal: AbortSignal,
  force: boolean,
) {
  const result = await fetchDubRange(start, new Date(+end - 1), force);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const entries: CalendarRelease[] = result.entries
    .filter(
      (entry) =>
        Date.parse(entry.episodeDate) >= +start &&
        Date.parse(entry.episodeDate) < +end,
    )
    .map((entry) => ({
      key: `dub:${entry.route}:${entry.episodeNumber}:${entry.episodeDate}`,
      episode: entry.episodeNumber,
      at: Date.parse(entry.episodeDate),
      language: "dub",
      anime: {
        ...(entry.media?.media || { id: 0, title: { english: entry.title } }),
        format: entry.format,
      },
      note: entry.airingStatus || undefined,
    }));
  let metadataWarning = "";
  // One batch per 50 IDs, rather than a lookup on every card or title guessing.
  const anilistIds = Array.from(
    new Set(
      entries
        .filter((entry) => !cachedAnime(entry.anime))
        .map((entry) => entry.anime.id)
        .filter((id) => id > 0),
    ),
  );
  const malIds = Array.from(
    new Set(
      entries
        .filter((entry) => !entry.anime.id && !cachedAnime(entry.anime))
        .map((entry) => entry.anime.idMal)
        .filter((id): id is number => !!id),
    ),
  );
  const metadata: CalendarAnime[] = entries
    .map((entry) => cachedAnime(entry.anime))
    .filter((anime): anime is CalendarAnime => !!anime);
  try {
    for (const [kind, ids] of [
      ["id_in", anilistIds],
      ["idMal_in", malIds],
    ] as const)
      for (let offset = 0; offset < ids.length; offset += 50) {
        const data = await fetchAnilist<{ Page: { media: CalendarAnime[] } }>(
          `query CalendarMetadata($ids:[Int]){Page(perPage:50){media(${kind}:$ids,type:ANIME){${fields}}}}`,
          { ids: ids.slice(offset, offset + 50) },
          signal,
        );
        metadata.push(...data.Page.media);
        data.Page.media.forEach(rememberAnime);
      }
  } catch (error) {
    if (signal.aborted) throw error;
    metadataWarning =
      "Some dub artwork or anime matches could not be refreshed.";
  }
  return {
    entries: entries
      .filter(
        (entry) =>
          !metadata.find((anime) => sameAnime(anime, entry.anime))?.isAdult,
      )
      .map((entry) => ({
        ...entry,
        anime: {
          ...entry.anime,
          ...metadata.find((anime) => sameAnime(anime, entry.anime)),
        },
      })),
    updatedAt: result.updatedAt,
    warning: [
      result.error
        ? "Dub timetable could not be fully refreshed." +
          (result.cached
            ? " Showing cached releases."
            : " Some dates may be unavailable.")
        : "",
      metadataWarning,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
export async function fetchCalendarRange(
  start: Date,
  end: Date,
  language: ScheduleLanguage,
  signal: AbortSignal,
  force = false,
): Promise<CalendarResult> {
  const requests = [
    ...(language !== "dub" ? [subRange(start, end, signal, force)] : []),
    ...(language !== "sub" ? [dubRange(start, end, signal, force)] : []),
  ];
  const results = await Promise.allSettled(requests);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const entries: CalendarRelease[] = [],
    warnings: string[] = [],
    times: number[] = [];
  for (const result of results)
    if (result.status === "fulfilled") {
      entries.push(...result.value.entries);
      if (result.value.warning) warnings.push(result.value.warning);
      if (result.value.updatedAt) times.push(result.value.updatedAt);
    } else
      warnings.push(
        "A schedule source is unavailable. Other releases are still shown.",
      );
  return {
    entries: Array.from(
      new Map(entries.map((entry) => [entry.key, entry])).values(),
    ),
    warnings,
    updatedAt: times.length ? Math.min(...times) : null,
  };
}
