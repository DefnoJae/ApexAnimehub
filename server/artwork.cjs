// Credentials remain on the server; return only public TMDB image URLs.
const mediaCache = new Map();
const normalize = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const cache = new Map(),
  pending = new Map();
async function json(url, headers = {}, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Artwork provider unavailable");
  return response.json();
}
function selectImages(images) {
  const valid = (i) => /^\/[A-Za-z0-9_.-]+$/.test(i.file_path || "");
  const rank = (a, b) =>
    (b.vote_average || 0) - (a.vote_average || 0) || b.width - a.width;
  return {
    logos: (images.logos || [])
      .filter(
        (i) =>
          valid(i) &&
          i.iso_639_1 === "en" &&
          i.width >= 300 &&
          /\.png$/i.test(i.file_path),
      )
      .sort(rank)
      .slice(0, 5)
      .map((i) => "https://image.tmdb.org/t/p/original" + i.file_path),
    backdrops: (images.backdrops || [])
      .filter(
        (i) =>
          valid(i) &&
          i.iso_639_1 === null &&
          i.width >= 1280 &&
          i.height >= 720 &&
          i.width / i.height >= 1.5 &&
          i.width / i.height <= 2.4,
      )
      .sort(rank)
      .slice(0, 5)
      .map((i) => "https://image.tmdb.org/t/p/original" + i.file_path),
  };
}
async function originalSeason(id) {
  const seen = new Set();
  let current = id,
    media;
  for (let depth = 0; depth < 12; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    let saved = mediaCache.get(current);
    if (!saved || Date.now() - saved.updated > 86400000) {
      const response = await json(
        "https://graphql.anilist.co",
        { "Content-Type": "application/json" },
        {
          method: "POST",
          body: JSON.stringify({
            query: `query ArtworkIdentity($id:Int!){Media(id:$id,type:ANIME){id format seasonYear title{english romaji native} relations{edges{relationType node{id type format startDate{year month day}}}}}}`,
            variables: { id: current },
          }),
        },
      );
      if (!response.data?.Media || response.errors?.length)
        throw new Error("Artwork identity unavailable");
      saved = { updated: Date.now(), media: response.data.Media };
      if (mediaCache.size >= 500)
        mediaCache.delete(mediaCache.keys().next().value);
      mediaCache.set(current, saved);
    }
    media = saved.media;
    // Films/specials keep their own artwork. Only walk actual season prequels.
    const prequels =
      media.format === "MOVIE"
        ? []
        : (media.relations?.edges || []).filter(
            (e) =>
              e.relationType === "PREQUEL" &&
              e.node?.type === "ANIME" &&
              ["TV", "TV_SHORT", "ONA"].includes(e.node.format) &&
              !seen.has(e.node.id),
          );
    prequels.sort(
      (a, b) =>
        (a.node.startDate?.year || 9999) - (b.node.startDate?.year || 9999) ||
        a.node.id - b.node.id,
    );
    if (!prequels.length) {
      const cycle = (media.relations?.edges || []).some(
        (e) => e.relationType === "PREQUEL" && seen.has(e.node?.id),
      );
      return cycle ? { ...media, id } : media;
    }
    current = prequels[0].node.id;
  }
  // Bound traversal and avoid recursive cache cycles for malformed relation data.
  return { ...media, id };
}
async function artwork(id) {
  const old = cache.get(id);
  if (old && Date.now() - old.updated < 86400000) return old.data;
  if (pending.has(id)) return pending.get(id);
  const request = (async () => {
    const token = process.env.TMDB_READ_ACCESS_TOKEN,
      key = process.env.TMDB_API_KEY;
    if (!token && !key) throw new Error("TMDB not configured");
    const tmdb = (path) =>
      json(
        "https://api.themoviedb.org/3/" +
          path +
          (path.includes("?") ? "&" : "?") +
          (key && !token ? "api_key=" + encodeURIComponent(key) : ""),
        token ? { Authorization: "Bearer " + token } : {},
      );
    const media = await originalSeason(id);
    // Reuse an original season's cache while preserving the requested identity.
    if (media.id !== id) return { ...(await artwork(media.id)), anilistId: id };
    let m = {};
    try {
      const mapped = await json(
        "https://api.ani.zip/mappings?anilist_id=" + media.id,
      );
      if (Number(mapped.mappings?.anilist_id) === media.id) m = mapped.mappings;
    } catch {
      /* A missing mapping should not block an exact-title TMDB lookup. */
    }
    const type = media.format === "MOVIE" ? "movie" : "tv";
    let tmdbId = m.themoviedb_id;
    if (!/^\d+$/.test(String(tmdbId || ""))) {
      const sources = [];
      if (/^tt\d+$/.test(m.imdb_id || "")) sources.push([m.imdb_id, "imdb_id"]);
      if (/^\d+$/.test(String(m.thetvdb_id || "")) && type === "tv")
        sources.push([m.thetvdb_id, "tvdb_id"]);
      for (const source of sources) {
        const found = await tmdb(
          "find/" + source[0] + "?external_source=" + source[1],
        );
        const matches = found[type + "_results"] || [];
        if (matches.length === 1) {
          tmdbId = matches[0].id;
          break;
        }
      }
    }
    if (!/^\d+$/.test(String(tmdbId || ""))) {
      const titles = [
        ...new Set(
          [
            media.title?.english,
            media.title?.romaji,
            media.title?.native,
          ].filter(Boolean),
        ),
      ];
      for (const title of titles) {
        const found = await tmdb(
          "search/" +
            type +
            "?language=en-US&query=" +
            encodeURIComponent(title),
        );
        const matches = (found.results || []).filter(
          (candidate) =>
            candidate.genre_ids?.includes(16) &&
            [
              candidate.name,
              candidate.original_name,
              candidate.title,
              candidate.original_title,
            ].some((name) => normalize(name) === normalize(title)) &&
            (!media.seasonYear ||
              Math.abs(
                Number(
                  String(
                    candidate.first_air_date || candidate.release_date || "",
                  ).slice(0, 4),
                ) - media.seasonYear,
              ) <= 1),
        );
        if (matches.length === 1) {
          tmdbId = matches[0].id;
          break;
        }
      }
    }
    const data = { anilistId: id, logos: [], backdrops: [] };
    if (/^\d+$/.test(String(tmdbId || "")))
      Object.assign(
        data,
        selectImages(
          await tmdb(
            type + "/" + tmdbId + "/images?include_image_language=en,null",
          ),
        ),
      );
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(id, { updated: Date.now(), data });
    return data;
  })()
    .catch((error) => {
      if (old) return old.data;
      throw error;
    })
    .finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}
async function handler(req, res) {
  const id = Number(
    new URL(req.url, "https://localhost").searchParams.get("anilist_id"),
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET" || !Number.isSafeInteger(id) || id <= 0) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Invalid artwork request" }));
  }
  try {
    const data = await artwork(id);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.end(JSON.stringify(data));
  } catch {
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "Artwork temporarily unavailable" }));
  }
}
module.exports = { handler, artwork, selectImages };
