export type FriendStatus =
  | "CURRENT"
  | "COMPLETED"
  | "PLANNING"
  | "PAUSED"
  | "DROPPED"
  | "REPEATING";
export interface FriendActivity {
  id: number;
  name: string;
  avatar?: string;
  status: FriendStatus;
  progress: number;
  total?: number;
  score?: number;
  repeat?: number;
}
export const friendStatuses: Record<
  FriendStatus,
  { label: string; color: string }
> = {
  CURRENT: { label: "Watching", color: "#62b9f5" },
  COMPLETED: { label: "Completed", color: "#7ad16c" },
  PLANNING: { label: "Planning", color: "#d5b45f" },
  PAUSED: { label: "Paused", color: "#a8a6b2" },
  DROPPED: { label: "Dropped", color: "#df7c80" },
  REPEATING: { label: "Rewatching", color: "#b69aeb" },
};
interface RawEntry {
  status?: string;
  score?: number;
  progress?: number;
  repeat?: number;
  mediaId?: number;
  media?: { episodes?: number | null };
  user?: { id?: number; name?: string; avatar?: { large?: string | null } };
}
export function normalizeFriends(
  entries: RawEntry[],
  mediaId: number,
): FriendActivity[] {
  const result = new Map<number, FriendActivity>();
  for (const entry of entries) {
    const user = entry.user;
    if (
      entry.mediaId !== mediaId ||
      !user?.id ||
      !user.name ||
      !Object.prototype.hasOwnProperty.call(friendStatuses, entry.status || "")
    )
      continue;
    let avatar: string | undefined;
    try {
      const url = new URL(user.avatar?.large || "");
      if (url.protocol === "https:") avatar = url.href;
    } catch {}
    result.set(user.id, {
      id: user.id,
      name: user.name,
      avatar,
      status: entry.status as FriendStatus,
      progress: Number.isFinite(entry.progress)
        ? Math.max(0, Math.floor(entry.progress!))
        : 0,
      total:
        typeof entry.media?.episodes === "number" && entry.media.episodes > 0
          ? entry.media.episodes
          : undefined,
      score:
        typeof entry.score === "number" &&
        Number.isFinite(entry.score) &&
        entry.score > 0 &&
        entry.score <= 100
          ? Math.round(entry.score) / 10
          : undefined,
      repeat:
        typeof entry.repeat === "number" && entry.repeat > 0
          ? entry.repeat
          : undefined,
    });
  }
  return Array.from(result.values());
}
const TTL = 5 * 60 * 1000;
const cache = new Map<
  string,
  { at: number; friends: FriendActivity[]; nextPage: number | null }
>();
const query = `query FriendsActivity($mediaId:Int!,$page:Int!){Viewer{id} Page(page:$page,perPage:50){pageInfo{hasNextPage} mediaList(mediaId:$mediaId,type:ANIME,isFollowing:true,sort:UPDATED_TIME_DESC){mediaId status score(format:POINT_100) progress repeat media{episodes} user{id name avatar{large}}}}}`;
export async function fetchFriendsActivity(
  mediaId: number,
  identity: string,
  page: number,
  signal: AbortSignal,
) {
  if (!Number.isSafeInteger(mediaId) || mediaId <= 0 || !identity)
    throw new Error("AniList account is still loading.");
  const key = identity + ":" + mediaId + ":" + page;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < TTL) return saved;
  const response = await fetch("/api/oauth/anilist/graphql", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { mediaId, page } }),
    signal,
  });
  const data = await response.json();
  if (
    !response.ok ||
    data.errors?.length ||
    !data.data?.Page ||
    String(data.data.Viewer?.id) !== identity
  )
    throw new Error(
      response.status === 401
        ? "Reconnect AniList to see following activity."
        : "Following activity is temporarily unavailable.",
    );
  const result = {
    at: Date.now(),
    friends: normalizeFriends(data.data.Page.mediaList || [], mediaId),
    nextPage: data.data.Page.pageInfo?.hasNextPage ? page + 1 : null,
  };
  if (cache.size >= 150) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
