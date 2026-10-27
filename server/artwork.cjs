// Credentials remain on the server; return only public TMDB image URLs.
const cache = new Map(),
  pending = new Map();
async function json(url, headers = {}) {
  const response = await fetch(url, {
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
          i.width >= 1920 &&
          i.height >= 1080 &&
          i.width / i.height >= 1.5 &&
          i.width / i.height <= 2.4,
      )
      .sort(rank)
      .slice(0, 5)
      .map((i) => "https://image.tmdb.org/t/p/original" + i.file_path),
  };
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
    const mapped = await json("https://api.ani.zip/mappings?anilist_id=" + id),
      m = mapped.mappings;
    if (Number(m?.anilist_id) !== id)
      throw new Error("Artwork mapping mismatch");
    const type = String(m.type).toUpperCase() === "MOVIE" ? "movie" : "tv";
    let tmdbId = m.themoviedb_id;
    if (!/^\d+$/.test(String(tmdbId || ""))) {
      const source = /^tt\d+$/.test(m.imdb_id || "")
        ? [m.imdb_id, "imdb_id"]
        : /^\d+$/.test(String(m.thetvdb_id || "")) && type === "tv"
          ? [m.thetvdb_id, "tvdb_id"]
          : null;
      if (source) {
        const found = await tmdb(
          "find/" + source[0] + "?external_source=" + source[1],
        );
        const matches = found[type + "_results"] || [];
        if (matches.length === 1) tmdbId = matches[0].id;
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
