import { anilistRequest, getAniListToken } from "../anilistAuth";
import type { LibraryEntry } from "../../hooks/useLibrary";
import type { ListStatus } from "../../hooks/useAccounts";

export interface AniListListPage {
  identity: string;
  name: string;
  hasNextPage: boolean;
  entries: LibraryEntry[];
}

export interface AniListEntry {
  status: ListStatus;
  progress: number;
  score?: number;
}

export interface AniListMutationEntry {
  id?: number;
  status: string;
  progress?: number;
  score?: number;
}

export interface AniListUpdateInput {
  id: number;
  status: ListStatus;
  progress?: number;
  score?: number;
  automatic?: boolean;
  manualProgress?: boolean;
  today?: string;
}

interface AniListFuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

type AniListStatus = "CURRENT" | "PLANNING" | "COMPLETED" | "PAUSED" | "DROPPED";

const statusMap: Record<ListStatus, AniListStatus> = {
  watching: "CURRENT",
  planning: "PLANNING",
  completed: "COMPLETED",
  paused: "PAUSED",
  dropped: "DROPPED",
};

// Exact query strings from server/list.cjs.
const LIST_QUERY = "query($user:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} mediaList(userId:$user,type:ANIME,sort:UPDATED_TIME_DESC){status progress score(format:POINT_100) updatedAt media{id idMal averageScore episodes title{english romaji} coverImage{extraLarge} bannerImage startDate{year} format}}}}";
const ENTRY_QUERY = "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{status progress score(format:POINT_100)}}}";
const EXISTING_ENTRY_QUERY = "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{progress status}}}";
const EXISTING_ENTRY_WITH_DATES_QUERY = "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{progress status startedAt{year month day} completedAt{year month day}}}}";
// Declare only the date being written. Declaring the other date as an
// unsupplied variable would send null and clear a date the user already has.
function saveMutation(dateField?: "startedAt" | "completedAt"): string {
  const declaration = dateField ? ",$" + dateField + ":FuzzyDateInput" : "";
  const argument = dateField ? "," + dateField + ":$" + dateField : "";
  return (
    "mutation($id:Int,$status:MediaListStatus,$progress:Int,$score:Int" +
    declaration +
    "){SaveMediaListEntry(mediaId:$id,status:$status,progress:$progress,scoreRaw:$score" +
    argument +
    "){id status progress score(format:POINT_100)}}"
  );
}
const ENTRY_ID_QUERY = "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{id}}}";
const DELETE_MUTATION = "mutation($id:Int){DeleteMediaListEntry(id:$id){deleted}}";

interface AniListMedia {
  id: number;
  idMal?: number | null;
  averageScore?: number;
  episodes?: number | null;
  title?: { english?: string; romaji?: string };
  coverImage?: { extraLarge?: string };
  bannerImage?: string;
  startDate?: { year?: number | null };
  format?: string;
}

interface AniListMediaListItem {
  status: string;
  progress: number;
  score?: number | null;
  updatedAt: number;
  media: AniListMedia;
}

// Only state in this module: serializes writes for the same anime. No result caching.
const pending = new Map<string, Promise<unknown>>();

function serialize<T>(id: number, operation: () => Promise<T>): Promise<T> {
  const key = "anilist:" + id;
  const previous = pending.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  pending.set(key, next);
  const release = () => {
    if (pending.get(key) === next) pending.delete(key);
  };
  void next.then(release, release);
  return next;
}

function reverseStatus(value: string): ListStatus {
  return (
    (Object.keys(statusMap) as ListStatus[]).find(
      (key) => statusMap[key] === value,
    ) || "watching"
  );
}

export function validateAniListUpdate(input: AniListUpdateInput): AniListUpdateInput {
  if (
    !Number.isSafeInteger(input.id) ||
    input.id <= 0 ||
    !Object.prototype.hasOwnProperty.call(statusMap, input.status)
  )
    throw new Error("Invalid anime or list status");
  if (
    input.progress !== undefined &&
    (!Number.isSafeInteger(input.progress) ||
      input.progress < 0 ||
      input.progress > 100000)
  )
    throw new Error("Invalid episode progress");
  if (
    input.score !== undefined &&
    (!Number.isInteger(input.score) || input.score < 0 || input.score > 10)
  )
    throw new Error("Score must be a whole number from 0 to 10");
  for (const field of ["automatic", "manualProgress"] as const)
    if (input[field] !== undefined && typeof input[field] !== "boolean")
      throw new Error("Invalid update mode");
  if (input.manualProgress && input.automatic)
    throw new Error("Manual progress cannot be automatic");
  if (input.today !== undefined) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.today);
    if (!match) throw new Error("Invalid date");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      throw new Error("Invalid date");
  }
  return input;
}

export async function readAniListList(
  page: number,
  signal?: AbortSignal,
): Promise<AniListListPage> {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw new Error("Invalid list page");
  const token = await getAniListToken(signal);
  const identity = token?.identity;
  if (
    typeof identity !== "string" ||
    !/^\d+$/.test(identity) ||
    !Number.isSafeInteger(Number(identity)) ||
    Number(identity) <= 0
  )
    throw new Error("AniList connection required. Please reconnect.");
  const data = await anilistRequest<{
    Page: {
      pageInfo: { hasNextPage: boolean };
      mediaList: AniListMediaListItem[];
    };
  }>(LIST_QUERY, { user: Number(identity), page }, signal);
  return {
    identity,
    name: token.name || identity,
    hasNextPage: data.Page.pageInfo.hasNextPage,
    entries: data.Page.mediaList.map((entry) => ({
      anime: {
        ...entry.media,
        startYear: entry.media.startDate?.year ?? undefined,
      },
      status: reverseStatus(entry.status),
      progress: entry.progress,
      score: (entry.score || 0) / 10,
      updatedAt: entry.updatedAt * 1000,
    })),
  };
}

export async function readAniListEntry(
  animeId: number,
  signal?: AbortSignal,
): Promise<AniListEntry | null> {
  validateAniListUpdate({ id: animeId, status: "watching" });
  const data = await anilistRequest<{
    Media: {
      mediaListEntry: {
        status: string;
        progress: number;
        score?: number | null;
      } | null;
    } | null;
  }>(ENTRY_QUERY, { id: animeId }, signal);
  const entry = data.Media?.mediaListEntry;
  if (!entry) return null;
  return {
    status: reverseStatus(entry.status),
    progress: entry.progress,
    score: (entry.score || 0) / 10,
  };
}

export async function updateAniListEntry(
  input: AniListUpdateInput,
  signal?: AbortSignal,
): Promise<AniListMutationEntry> {
  validateAniListUpdate(input);
  return serialize(input.id, async () => {
    let progress = input.progress;
    let existing:
      | {
          progress?: number;
          status?: string;
          startedAt?: AniListFuzzyDate | null;
          completedAt?: AniListFuzzyDate | null;
        }
      | null
      | undefined;
    const needsRead =
      (progress !== undefined && !input.manualProgress) ||
      input.automatic ||
      input.today !== undefined;
    if (needsRead) {
      const data = await anilistRequest<{
        Media: {
          mediaListEntry: {
            progress: number;
            status: string;
            startedAt?: AniListFuzzyDate | null;
            completedAt?: AniListFuzzyDate | null;
          } | null;
        } | null;
      }>(
        input.today !== undefined
          ? EXISTING_ENTRY_WITH_DATES_QUERY
          : EXISTING_ENTRY_QUERY,
        { id: input.id },
        signal,
      );
      if (!data.Media) throw new Error("Anime not found");
      existing = data.Media.mediaListEntry;
      if (progress !== undefined && !input.manualProgress)
        progress = Math.max(progress, existing?.progress || 0);
    }
    const status =
      input.automatic && existing?.status === "COMPLETED"
        ? "COMPLETED"
        : statusMap[input.status];
    let dateWrite:
      | {
          field: "startedAt" | "completedAt";
          value: { year: number; month: number; day: number };
        }
      | undefined;
    if (input.today !== undefined) {
      const fuzzy = {
        year: Number(input.today.slice(0, 4)),
        month: Number(input.today.slice(5, 7)),
        day: Number(input.today.slice(8, 10)),
      };
      const watching =
        existing?.status === "CURRENT" || existing?.status === "REPEATING";
      const hasStart = !!(
        existing?.startedAt &&
        (existing.startedAt.year ||
          existing.startedAt.month ||
          existing.startedAt.day)
      );
      const hasFinish = !!(
        existing?.completedAt &&
        (existing.completedAt.year ||
          existing.completedAt.month ||
          existing.completedAt.day)
      );
      if (status === "CURRENT" && !watching && !hasStart)
        dateWrite = { field: "startedAt", value: fuzzy };
      else if (
        status === "COMPLETED" &&
        existing?.status !== "COMPLETED" &&
        !hasFinish
      )
        dateWrite = { field: "completedAt", value: fuzzy };
    }
    const data = await anilistRequest<{
      SaveMediaListEntry: AniListMutationEntry | null;
    }>(
      saveMutation(dateWrite?.field),
      {
        id: input.id,
        status,
        ...(progress !== undefined ? { progress } : {}),
        ...(input.score !== undefined ? { score: Math.round(input.score * 10) } : {}),
        ...(dateWrite ? { [dateWrite.field]: dateWrite.value } : {}),
      },
      signal,
    );
    if (!data.SaveMediaListEntry)
      throw new Error("AniList did not confirm the update");
    return data.SaveMediaListEntry;
  });
}

export async function removeAniListEntry(
  animeId: number,
  signal?: AbortSignal,
): Promise<boolean> {
  validateAniListUpdate({ id: animeId, status: "watching" });
  return serialize(animeId, async () => {
    const data = await anilistRequest<{
      Media: { mediaListEntry: { id: number } | null } | null;
    }>(ENTRY_ID_QUERY, { id: animeId }, signal);
    const entryId = data.Media?.mediaListEntry?.id;
    if (!entryId) return true;
    const deleted = await anilistRequest<{
      DeleteMediaListEntry?: { deleted?: boolean };
    }>(DELETE_MUTATION, { id: entryId }, signal);
    if (!deleted.DeleteMediaListEntry?.deleted)
      throw new Error("AniList did not confirm removal");
    return true;
  });
}
