export interface EpisodeMetadata {
  title?: string;
  image?: string;
}
type Episodes = Record<string, EpisodeMetadata>;
const pending = new Map<number, Promise<Episodes>>();
const memory = new Map<number, { updated: number; episodes: Episodes }>();
const DAY = 86400000;
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function parseEpisodes(data: unknown, id: number): Episodes {
  if (!data || typeof data !== "object") return {};
  const payload = data as {
    mappings?: { anilist_id?: number };
    episodes?: Record<
      string,
      { episode?: string; title?: Record<string, unknown>; image?: unknown }
    >;
  };
  if (Number(payload.mappings?.anilist_id) !== id || !payload.episodes)
    return {};
  const result: Episodes = {};
  for (const [number, episode] of Object.entries(payload.episodes)) {
    // Use AniDB's local episode key, never TVDB absolute/season numbering.
    if (
      !/^[1-9]\d*$/.test(number) ||
      !episode ||
      (episode.episode && String(episode.episode) !== number)
    )
      continue;
    const image = text(episode.image);
    result[number] = {
      title: text(episode.title?.en) || text(episode.title?.["x-jat"]),
      image: image?.startsWith("https://") ? image : undefined,
    };
  }
  return result;
}

export async function fetchEpisodeMetadata(id: number): Promise<Episodes> {
  const key = `apex_episode_metadata_v1_${id}`;
  let cached = memory.get(id);
  if (!cached) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        saved &&
        Number.isFinite(saved.updated) &&
        saved.episodes &&
        typeof saved.episodes === "object"
      )
        cached = saved;
    } catch {}
  }
  if (cached && Date.now() - cached.updated < DAY) return cached.episodes;
  const existing = pending.get(id);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(
        `https://api.ani.zip/mappings?anilist_id=${id}`,
        { signal: controller.signal, credentials: "omit" },
      );
      if (!response.ok) throw new Error("Episode metadata unavailable");
      const episodes = parseEpisodes(await response.json(), id);
      if (!Object.keys(episodes).length) throw new Error("No matched episodes");
      const entry = { updated: Date.now(), episodes };
      memory.set(id, entry);
      try {
        localStorage.setItem(key, JSON.stringify(entry));
      } catch {}
      return episodes;
    } catch {
      const fallback = cached?.episodes || {};
      memory.set(id, { updated: Date.now() - DAY + 60000, episodes: fallback });
      return fallback;
    } finally {
      clearTimeout(timer);
      pending.delete(id);
    }
  })();
  pending.set(id, request);
  return request;
}
