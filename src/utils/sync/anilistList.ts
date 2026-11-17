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
const LIST_QUERY = "query($user:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} mediaList(userId:$user,type:ANIME,sort:UPDATED_TIME_DESC){status progress score(format:POINT_100) updatedAt media{id idMal averageScore episodes title{english romaji} coverImage{extraLarge} bannerImage}}}}";
const ENTRY_QUERY = "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{status progress score(format:POINT_100)}}}";
const EXISTING_ENTRY_QUERY = "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{progress status}}}";
const SAVE_MUTATION = "mutation($id:Int,$status:MediaListStatus,$progress:Int,$score:Int){SaveMediaListEntry(mediaId:$id,status:$status,progress:$progress,scoreRaw:$score){id status progress score(format:POINT_100)}}";
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
      anime: entry.media,
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
    let existing: { progress?: number; status?: string } | null | undefined;
    if ((progress !== undefined && !input.manualProgress) || input.automatic) {
      const data = await anilistRequest<{
        Media: {
          mediaListEntry: { progress: number; status: string } | null;
        } | null;
      }>(EXISTING_ENTRY_QUERY, { id: input.id }, signal);
      if (!data.Media) throw new Error("Anime not found");
      existing = data.Media.mediaListEntry;
      if (progress !== undefined && !input.manualProgress)
        progress = Math.max(progress, existing?.progress || 0);
    }
    const status =
      input.automatic && existing?.status === "COMPLETED"
        ? "COMPLETED"
        : statusMap[input.status];
    const data = await anilistRequest<{
      SaveMediaListEntry: AniListMutationEntry | null;
    }>(
      SAVE_MUTATION,
      {
        id: input.id,
        status,
        ...(progress !== undefined ? { progress } : {}),
        ...(input.score !== undefined ? { score: Math.round(input.score * 10) } : {}),
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
