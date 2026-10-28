import type { DashboardAnime } from "../components/HomeDashboard";
export interface StoryActivity {
  id: number;
  createdAt: number;
  status: string;
  progress?: string;
  user: { id: number; name: string; avatar?: string };
  anime: DashboardAnime;
  score?: number;
}
export interface StoryGroup {
  user: StoryActivity["user"];
  activities: StoryActivity[];
}
interface RawActivity {
  id?: number;
  createdAt?: number;
  status?: string;
  progress?: string | null;
  user?: { id?: number; name?: string; avatar?: { large?: string | null } };
  media?: DashboardAnime & { type?: string; isAdult?: boolean };
}
export function groupStories(rows: RawActivity[]): StoryGroup[] {
  const groups = new Map<number, StoryGroup>(),
    seen = new Set<number>();
  for (const row of rows) {
    if (
      !row.id ||
      seen.has(row.id) ||
      !row.createdAt ||
      !row.status ||
      !row.user?.id ||
      !row.user.name ||
      !row.media?.id ||
      row.media.type !== "ANIME" ||
      row.media.isAdult
    )
      continue;
    seen.add(row.id);
    const user = {
      id: row.user.id,
      name: row.user.name,
      avatar: secureImage(row.user.avatar?.large),
    };
    const activity: StoryActivity = {
      id: row.id,
      createdAt: row.createdAt,
      status: row.status,
      progress: row.progress || undefined,
      user,
      anime: {
        ...row.media,
        bannerImage: secureImage(row.media.bannerImage),
        coverImage: {
          extraLarge: secureImage(row.media.coverImage?.extraLarge),
        },
      },
    };
    if (!groups.has(user.id)) groups.set(user.id, { user, activities: [] });
    groups.get(user.id)!.activities.push(activity);
  }
  return Array.from(groups.values())
    .sort(
      (a, b) =>
        Math.max(...b.activities.map((x) => x.createdAt)) -
        Math.max(...a.activities.map((x) => x.createdAt)),
    )
    .map((group) => ({
      ...group,
      activities: group.activities.sort((a, b) => a.createdAt - b.createdAt),
    }));
}
function secureImage(value?: string | null) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function activityLabel(activity: StoryActivity) {
  const status =
    activity.status.charAt(0).toUpperCase() + activity.status.slice(1);
  return status + (activity.progress ? " " + activity.progress : "");
}
export function activityAge(seconds: number) {
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  return delta < 60
    ? "Just now"
    : delta < 3600
      ? Math.floor(delta / 60) + "m ago"
      : delta < 86400
        ? Math.floor(delta / 3600) + "h ago"
        : Math.floor(delta / 86400) + "d ago";
}
const cache = new Map<
  string,
  { at: number; groups: StoryGroup[]; warning?: string }
>();
const feedQuery = `query FollowingStories($since:Int!){Viewer{id} Page(page:1,perPage:50){activities(isFollowing:true,type:ANIME_LIST,createdAt_greater:$since,sort:ID_DESC){... on ListActivity{id createdAt status progress user{id name avatar{large}} media{id idMal type isAdult title{english romaji} bannerImage coverImage{extraLarge} episodes}}}}}`;
async function request(
  query: string,
  variables: Record<string, unknown>,
  identity: string,
  signal: AbortSignal,
) {
  const response = await fetch("/api/oauth/anilist/graphql", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  const json = await response.json();
  if (
    !response.ok ||
    json.errors?.length ||
    String(json.data?.Viewer?.id) !== identity
  )
    throw new Error(
      response.status === 401
        ? "Reconnect AniList to view following activity."
        : "Following activity is temporarily unavailable.",
    );
  return json.data;
}
export async function fetchFollowingStories(
  identity: string,
  signal: AbortSignal,
  force = false,
) {
  const saved = cache.get(identity);
  if (!force && saved && Date.now() - saved.at < 300000) return saved;
  const data = await request(
    feedQuery,
    { since: Math.floor(Date.now() / 1000) - 7 * 86400 },
    identity,
    signal,
  );
  const groups = groupStories(data.Page?.activities || []);
  let warning: string | undefined;
  // List activities contain no score. Batch the matching users' current list scores separately.
  try {
    for (let offset = 0; offset < groups.length; offset += 10) {
      const batch = groups.slice(offset, offset + 10);
      const query =
        "query FollowingStoryScores{Viewer{id} " +
        batch
          .map(
            (group) =>
              `u${group.user.id}:Page(perPage:50){mediaList(userId:${group.user.id},mediaId_in:[${Array.from(new Set(group.activities.map((a) => a.anime.id))).join(",")}],type:ANIME){mediaId score(format:POINT_10)}}`,
          )
          .join(" ") +
        "}";
      const scores = await request(query, {}, identity, signal);
      for (const group of batch)
        for (const activity of group.activities) {
          const entry = scores["u" + group.user.id]?.mediaList?.find(
            (entry: { mediaId: number }) => entry.mediaId === activity.anime.id,
          );
          if (
            typeof entry?.score === "number" &&
            entry.score > 0 &&
            entry.score <= 10
          )
            activity.score = entry.score;
        }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    warning = "Some current list ratings could not be loaded.";
  }
  const result = { at: Date.now(), groups, warning };
  if (cache.size >= 5) cache.delete(cache.keys().next().value!);
  cache.set(identity, result);
  return result;
}
export function readSeenStories(identity: string): number[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("apex_stories_seen_v1_" + identity) || "[]",
    );
    return Array.isArray(value)
      ? value.filter((id) => Number.isSafeInteger(id) && id > 0).slice(-500)
      : [];
  } catch {
    return [];
  }
}
