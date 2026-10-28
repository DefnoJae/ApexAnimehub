const cache = new Map(),
  pending = new Map();
const normalize = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
async function json(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("Episode provider unavailable");
  return r.json();
}
function matchSeason(seasons, media) {
  const date = media.startDate;
  const start =
    date?.year && date?.month && date?.day
      ? Date.UTC(date.year, date.month - 1, date.day)
      : null;
  const valid = (seasons || []).filter(
    (s) => s.season_number > 0 && s.air_date,
  );
  if (start !== null) {
    const ordered = valid
      .map((s) => ({
        ...s,
        distance: Math.abs(Date.parse(s.air_date) - start),
      }))
      .filter((s) => s.distance <= 45 * 86400000)
      .sort((a, b) => a.distance - b.distance);
    if (
      ordered.length &&
      (!ordered[1] || ordered[0].distance < ordered[1].distance)
    )
      return ordered[0].season_number;
  }
  const year = date?.year;
  const same = valid.filter(
    (s) => !year || Number(s.air_date.slice(0, 4)) === year,
  );
  return same.length === 1 ? same[0].season_number : null;
}
function episodeRows(episodes, media) {
  const start =
    media.startDate?.year && media.startDate?.month && media.startDate?.day
      ? Date.UTC(
          media.startDate.year,
          media.startDate.month - 1,
          media.startDate.day,
        )
      : null;
  const sorted = [...(episodes || [])]
    .filter((e) => e.episode_number > 0)
    .sort((a, b) => a.episode_number - b.episode_number);
  if (!sorted.length) return {};
  let offset = 0;
  if (start !== null) {
    const matches = sorted
      .map((e, i) => ({ i, d: Math.abs(Date.parse(e.air_date) - start) }))
      .filter((e) => e.d <= 3 * 86400000)
      .sort((a, b) => a.d - b.d);
    if (!matches.length || matches[1]?.d === matches[0].d) return {};
    offset = matches[0].i;
  }
  const rows = {};
  sorted
    .slice(offset, media.episodes ? offset + media.episodes : undefined)
    .forEach((e, i) => {
      rows[String(i + 1)] = {
        title: e.name || undefined,
        image: /^\/[A-Za-z0-9_.-]+$/.test(e.still_path || "")
          ? "https://image.tmdb.org/t/p/w780" + e.still_path
          : undefined,
        overview: e.overview || undefined,
        airDate: e.air_date || undefined,
        runtime:
          typeof e.runtime === "number" && e.runtime > 0
            ? e.runtime
            : undefined,
      };
    });
  return rows;
}
async function episodesFor(id) {
  const saved = cache.get(id);
  if (
    saved &&
    Date.now() - saved.at <
      (Object.values(saved.episodes).some((e) => e.image) ? 86400000 : 60000)
  )
    return saved.episodes;
  if (pending.has(id)) return pending.get(id);
  const task = (async () => {
    const key = process.env.TMDB_API_KEY,
      token = process.env.TMDB_READ_ACCESS_TOKEN;
    if (!key && !token) throw new Error("TMDB not configured");
    const tmdb = (path) =>
      json(
        "https://api.themoviedb.org/3/" +
          path +
          (path.includes("?") ? "&" : "?") +
          (token ? "" : "api_key=" + encodeURIComponent(key)),
        { headers: token ? { Authorization: "Bearer " + token } : {} },
      );
    const [identity, mapping] = await Promise.all([
      json("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query:
            "query($id:Int!){Media(id:$id,type:ANIME){id title{english romaji native} episodes format startDate{year month day}}}",
          variables: { id },
        }),
      }),
      json("https://api.ani.zip/mappings?anilist_id=" + id).catch(() => ({})),
    ]);
    const media = identity.data?.Media;
    if (media?.id !== id) throw new Error("Episode identity unavailable");
    const m =
      Number(mapping.mappings?.anilist_id) === id ? mapping.mappings : {};
    if (media.format === "MOVIE" || m?.type === "MOVIE") return {};
    let tmdbId = m?.themoviedb_id;
    if (!/^\d+$/.test(String(tmdbId || ""))) {
      for (const title of [
        ...new Set(
          [
            media.title?.english,
            media.title?.romaji,
            media.title?.native,
          ].filter(Boolean),
        ),
      ]) {
        const found = await tmdb(
          "search/tv?query=" + encodeURIComponent(title) + "&language=en-US",
        );
        const matches = (found.results || []).filter(
          (item) =>
            item.genre_ids?.includes(16) &&
            [item.name, item.original_name].some(
              (name) => normalize(name) === normalize(title),
            ) &&
            (!media.startDate?.year ||
              Math.abs(
                Number(String(item.first_air_date || "").slice(0, 4)) -
                  media.startDate.year,
              ) <= 1),
        );
        if (matches.length === 1) {
          tmdbId = matches[0].id;
          break;
        }
      }
    }
    let result = {};
    if (/^\d+$/.test(String(tmdbId || ""))) {
      const series = await tmdb("tv/" + tmdbId + "?language=en-US");
      const season = matchSeason(series.seasons, media);
      if (season !== null) {
        const data = await tmdb(
          "tv/" + tmdbId + "/season/" + season + "?language=en-US",
        );
        result = episodeRows(data.episodes, media);
      }
    }
    if (cache.size >= 300) cache.delete(cache.keys().next().value);
    cache.set(id, { at: Date.now(), episodes: result });
    return result;
  })().finally(() => pending.delete(id));
  pending.set(id, task);
  return task;
}
async function handler(req, res) {
  const id = Number(
    new URL(req.url, "https://localhost").searchParams.get("anilist_id"),
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET" || !Number.isSafeInteger(id) || id <= 0) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Invalid anime ID" }));
  }
  try {
    const episodes = await episodesFor(id);
    res.setHeader(
      "Cache-Control",
      Object.values(episodes).some((e) => e.image)
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "public, s-maxage=60",
    );
    res.end(JSON.stringify({ anilistId: id, episodes }));
  } catch {
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "Episode artwork unavailable" }));
  }
}
module.exports = { handler, episodesFor, matchSeason, episodeRows };
