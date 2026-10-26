const cache = new Map();
const pending = new Map();
function coverId(url) {
  try {
    const u = new URL(url);
    return u.hostname === "s4.anilist.co"
      ? Number(/\/(?:b[xy])?(\d+)[-.]/.exec(u.pathname)?.[1])
      : 0;
  } catch {
    return 0;
  }
}
async function resolve(id, episode) {
  const { HttpClient, AnimeParadiseProvider } = await import("anime-sdk");
  const provider = new AnimeParadiseProvider(
    new HttpClient({ timeoutMs: 8000 }),
  );
  const signal = AbortSignal.timeout(25000);
  const metadata = await fetch("https://graphql.anilist.co", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "query($id:Int){Media(id:$id,type:ANIME){id title{english romaji}}}",
      variables: { id },
    }),
  });
  if (!metadata.ok) throw new Error("Anime metadata unavailable");
  const media = (await metadata.json()).data?.Media;
  if (media?.id !== id) throw new Error("Anime not found");
  let match;
  for (const title of [
    ...new Set([media.title.english, media.title.romaji].filter(Boolean)),
  ]) {
    const hits = await provider.search(title, { signal });
    // Require the source's AniList cover ID: never select a similarly named season.
    match = hits.find((hit) => coverId(hit.thumbnailUrl) === id);
    if (match) break;
  }
  if (!match)
    throw new Error("No exact source match for this anime. Try MegaPlay.");
  const units = await provider.fetchContentUnits(match.id, { signal });
  const unit = units.find((item) => item.number === episode);
  if (!unit)
    throw new Error(
      "This episode is not available on Apex Player. Try MegaPlay.",
    );
  const result = await provider.resolveStream(unit.id, "sub", { signal });
  const source =
    result.type === "video" &&
    result.streams.find((stream) => stream.isHLS && allowed(stream.sourceUrl));
  if (!source) throw new Error("No compatible stream available. Try MegaPlay.");
  return {
    url: source.sourceUrl,
    subtitles: (source.subtitles || []).filter((track) => allowed(track.url)),
    audio: "sub",
    provider: "AnimeParadise",
  };
}
function allowed(value) {
  try {
    return new URL(value).origin === "https://stream.animeparadise.moe";
  } catch {
    return false;
  }
}
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  const url = new URL(req.url, "https://localhost");
  const id = Number(url.searchParams.get("id")),
    episode = Number(url.searchParams.get("episode"));
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(episode) ||
    episode < 1 ||
    episode > 10000
  ) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Invalid anime or episode" }));
  }
  const key = `${id}:${episode}`;
  try {
    const saved = cache.get(key);
    if (saved && Date.now() - saved.at < 60000)
      return res.end(JSON.stringify(saved.value));
    let request = pending.get(key);
    if (!request) {
      if (pending.size >= 4) {
        res.statusCode = 503;
        return res.end(
          JSON.stringify({ error: "Player source is busy. Please retry." }),
        );
      }
      request = resolve(id, episode);
      pending.set(key, request);
      request
        .then((value) => {
          if (cache.size >= 100) cache.delete(cache.keys().next().value);
          cache.set(key, { at: Date.now(), value });
        })
        .catch(() => {})
        .finally(() => pending.delete(key));
    }
    res.end(JSON.stringify(await request));
  } catch (error) {
    res.statusCode = 502;
    res.end(
      JSON.stringify({
        error: error.message || "Source unavailable. Try MegaPlay.",
      }),
    );
  }
}
module.exports = { handler, coverId, allowed };
