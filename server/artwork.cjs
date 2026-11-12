// Credentials remain on the server; return only public TMDB image URLs.
const mediaCache = new Map();
const normalize = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u00d7\u2715\u2716]/gu, "x")
    .replace(/[^\p{L}\p{N}]/gu, "");
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
          (i.iso_639_1 === "en" || i.iso_639_1 === null) &&
          i.width >= 32 &&
          i.height >= 12 &&
          /\.(png|svg|webp)$/i.test(i.file_path),
      )
      .sort(
        (a, b) =>
          (a.iso_639_1 === "en" ? 0 : 1) - (b.iso_639_1 === "en" ? 0 : 1) ||
          rank(a, b),
      )
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
async function mediaIdentity(id) {
  const saved = mediaCache.get(id);
  if (saved && Date.now() - saved.updated < 21600000) return saved.media;
  const response = await json(
    "https://graphql.anilist.co",
    { "Content-Type": "application/json" },
    {
      method: "POST",
      body: JSON.stringify({
        query: `query ArtworkIdentity($id:Int!){Media(id:$id,type:ANIME){id format seasonYear title{english romaji native} relations{edges{relationType node{id type format startDate{year month day}}}}}}`,
        variables: { id },
      }),
    },
  );
  if (response.errors?.length || response.data?.Media?.id !== id)
    throw new Error("Artwork identity unavailable");
  const media = response.data.Media;
  if (mediaCache.size >= 500) mediaCache.delete(mediaCache.keys().next().value);
  mediaCache.set(id, { updated: Date.now(), media });
  return media;
}
function titles(media) {
  return [
    ...new Set(
      [media.title?.english, media.title?.romaji, media.title?.native].filter(
        Boolean,
      ),
    ),
  ];
}
function withoutReleaseYear(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s*[\[(](?:19|20)\d{2}[\])]\s*$/u, "")
    .trim();
}
function searchTitles(media) {
  return [
    ...new Set(
      titles(media)
        .flatMap((title) => [title, withoutReleaseYear(title)])
        .filter(Boolean),
    ),
  ];
}
function exactCandidate(candidate, media) {
  const names = [
    candidate.name,
    candidate.original_name,
    candidate.title,
    candidate.original_title,
  ]
    .filter(Boolean)
    .map((name) => normalize(withoutReleaseYear(name)));
  const year = Number(
    String(candidate.first_air_date || candidate.release_date || "").slice(
      0,
      4,
    ),
  );
  return (
    candidate.genre_ids?.includes(16) &&
    titles(media).some((title) =>
      names.includes(normalize(withoutReleaseYear(title))),
    ) &&
    (!media.seasonYear || (year > 0 && Math.abs(year - media.seasonYear) <= 1))
  );
}
function seriesTitle(title) {
  return title
    .replace(
      /\s*[-–:]?\s+\d+(?:st|nd|rd|th)\s*(?:[-–&＆]\s*\d+(?:st|nd|rd|th)\s*)?stage\s*$/i,
      "",
    )
    .replace(/\b(?:\d+(?:st|nd|rd|th)?\s+)?(?:season|cour|part)\s*\d*\b/gi, "")
    .replace(/\s+(?:\d+|II|III|IV)\s*$/i, "");
}
function sameSeries(a, b) {
  return titles(a).some((left) =>
    titles(b).some((right) => {
      const base = normalize(seriesTitle(left));
      return base && base === normalize(seriesTitle(right));
    }),
  );
}
// Netflix publishes one English title treatment for both Steel Ball Run stages.
// Source: https://www.netflix.com/title/82116553
const officialLogos = {
  190327: "/title-logos/steel-ball-run.png",
  210482: "/title-logos/steel-ball-run.png",
};
async function ownArtwork(media, tmdb) {
  const type = media.format === "MOVIE" ? "movie" : "tv";
  let tmdbId;
  // Search the selected entry BEFORE mapping/prequel fallbacks. A sequel or
  // re-edit can have a dedicated TMDB series with its own logos and backdrops.
  for (const title of searchTitles(media)) {
    const found = await tmdb(
      "search/" + type + "?language=en-US&query=" + encodeURIComponent(title),
    );
    const matches = (found.results || []).filter((candidate) =>
      exactCandidate(candidate, media),
    );
    if (matches.length === 1) {
      tmdbId = matches[0].id;
      break;
    }
  }
  let match = tmdbId ? "exact" : "none";
  if (!tmdbId) {
    let mapping = {};
    try {
      const mapped = await json(
        "https://api.ani.zip/mappings?anilist_id=" + media.id,
      );
      if (Number(mapped.mappings?.anilist_id) === media.id)
        mapping = mapped.mappings;
    } catch {
      /* An absent mapping does not invalidate the title search. */
    }
    const candidates = [];
    if (/^\d+$/.test(String(mapping.themoviedb_id || "")))
      candidates.push(Number(mapping.themoviedb_id));
    const sources = [];
    if (/^tt\d+$/.test(mapping.imdb_id || ""))
      sources.push([mapping.imdb_id, "imdb_id"]);
    if (type === "tv" && /^\d+$/.test(String(mapping.thetvdb_id || "")))
      sources.push([mapping.thetvdb_id, "tvdb_id"]);
    if (!candidates.length)
      for (const source of sources) {
        const found = await tmdb(
          "find/" + source[0] + "?external_source=" + source[1],
        );
        const matches = found[type + "_results"] || [];
        if (matches.length === 1) {
          candidates.push(matches[0].id);
          break;
        }
      }
    // Mapping databases can point to an older franchise entry. Verify its
    // identity too; never accept a generic franchise title just for its images.
    for (const candidate of candidates) {
      const details = await tmdb(type + "/" + candidate + "?language=en-US");
      const identity = {
        ...details,
        genre_ids:
          details.genres?.map((genre) => genre.id) || details.genre_ids,
      };
      if (
        exactCandidate(identity, media) ||
        (titles(media).some((title) =>
          /(?:\bseason\s*\d|\b\d+(?:nd|rd|th)\s+season|\bpart\s*\d)/i.test(
            title,
          ),
        ) &&
          details.genres?.some((genre) => genre.id === 16) &&
          sameSeries(media, {
            title: {
              english: details.name || details.title,
              romaji: details.original_name || details.original_title,
            },
          }))
      ) {
        tmdbId = candidate;
        match = "mapped";
        break;
      }
    }
  }
  return tmdbId
    ? {
        ...selectImages(
          await tmdb(
            type + "/" + tmdbId + "/images?include_image_language=en,null",
          ),
        ),
        tmdbId,
        tmdbType: type,
        match,
      }
    : { logos: [], backdrops: [], match };
}
async function artwork(id, ancestors = new Set()) {
  if (ancestors.has(id) || ancestors.size >= 4)
    return { anilistId: id, logos: [], backdrops: [], match: "none" };
  const visited = new Set(ancestors);
  visited.add(id);
  const old = cache.get(id);
  const ttl =
    old?.data.match === "exact" &&
    old.data.logos.length &&
    old.data.backdrops.length
      ? 21600000
      : 900000;
  if (old && Date.now() - old.updated < ttl) return old.data;
  // Related traversals do not await an unrelated pending traversal, preventing
  // deadlocks if malformed relationship data contains a cycle.
  if (!ancestors.size && pending.has(id)) return pending.get(id);
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
    const media = await mediaIdentity(id);
    const data = { anilistId: id, ...(await ownArtwork(media, tmdb)) };
    if (!data.logos.length && officialLogos[id]) {
      data.logos = [officialLogos[id]];
      if (data.match === "none") data.match = "official";
    }
    if (
      (!data.logos.length || !data.backdrops.length) &&
      media.format !== "MOVIE"
    ) {
      const relations = (media.relations?.edges || []).filter(
        (edge) =>
          (["PREQUEL", "PARENT"].includes(edge.relationType) ||
            (edge.relationType === "OTHER" &&
              !data.logos.length &&
              titles(media).some((title) => seriesTitle(title) !== title))) &&
          edge.node?.type === "ANIME" &&
          ["TV", "TV_SHORT", "ONA"].includes(edge.node.format) &&
          !visited.has(edge.node.id),
      );
      for (const edge of relations.slice(0, 3)) {
        try {
          const parent = await mediaIdentity(edge.node.id);
          if (!sameSeries(media, parent)) continue;
          const fallback = await artwork(parent.id, visited);
          if (!data.logos.length && fallback.logos.length) {
            data.logos = fallback.logos;
            data.match = "related";
          }
          if (
            edge.relationType !== "OTHER" &&
            !data.backdrops.length &&
            fallback.backdrops.length
          ) {
            data.backdrops = fallback.backdrops;
            data.match = "related";
          }
        } catch {
          /* Missing relatives must not discard this anime's own images. */
        }
        if (
          data.match === "none" &&
          (data.logos.length || data.backdrops.length)
        )
          data.match = "related";
        if (data.logos.length && data.backdrops.length) break;
      }
    }
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(id, { updated: Date.now(), data });
    return data;
  })()
    .catch((error) => {
      if (old) return old.data;
      if (officialLogos[id])
        return {
          anilistId: id,
          logos: [officialLogos[id]],
          backdrops: [],
          match: "official",
        };
      throw error;
    })
    .finally(() => {
      if (!ancestors.size) pending.delete(id);
    });
  if (!ancestors.size) pending.set(id, request);
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
      data.match === "exact" && data.logos.length && data.backdrops.length
        ? "public, s-maxage=21600, stale-while-revalidate=3600"
        : "public, s-maxage=900",
    );
    res.end(JSON.stringify(data));
  } catch {
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "Artwork temporarily unavailable" }));
  }
}
module.exports = { handler, artwork, selectImages };
