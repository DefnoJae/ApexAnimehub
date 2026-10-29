// SignSync adapts SeaSubs' episode matching, bounded XZ reader and signs extraction.
const { timingCues, deriveSignsSongsAss } = require("./signsync-text.cjs");
const cache = new Map(),
  pending = new Map();
const LIMIT = 2 * 1024 * 1024;
function allowed(raw) {
  const u = new URL(raw);
  return (
    u.protocol === "https:" &&
    !u.username &&
    !u.password &&
    !u.port &&
    ((["animetosho.org", "animetosho.net", "storage.animetosho.net"].includes(
      u.hostname,
    ) &&
      /^\/(?:storage\/attach\/|attachments\/|releases\/)/.test(u.pathname)) ||
      ([
        "feed.animetosho.xyz",
        "feed.animetosho.org",
        "feed.animetosho.net",
      ].includes(u.hostname) &&
        /^\/(?:feed\/)?json$/.test(u.pathname)) ||
      (u.hostname === "api.ani.zip" && u.pathname === "/mappings"))
  );
}
async function read(url, signal, redirects = 0) {
  if (!allowed(url) || redirects > 2)
    throw new Error("Unsupported subtitle host");
  const r = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
  });
  if (r.status >= 300 && r.status < 400 && r.headers.get("location"))
    return read(
      new URL(r.headers.get("location"), url).href,
      signal,
      redirects + 1,
    );
  if (!r.ok) throw new Error("Subtitle source unavailable (" + r.status + ")");
  if (Number(r.headers.get("content-length")) > LIMIT)
    throw new Error("Subtitle file too large");
  const chunks = [];
  let size = 0;
  for await (const chunk of r.body) {
    size += chunk.length;
    if (size > LIMIT) {
      await r.body.cancel?.().catch(() => {});
      throw new Error("Subtitle file too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function json(url, signal) {
  return JSON.parse((await read(url, signal)).toString("utf8"));
}
function episodeAttachments(torrent, episode, season) {
  const files = torrent.files || [];
  const matches = (name, requireNumber) => {
    const match = name.match(
      /S(\d{1,2})[ ._-]*E(\d{1,3})(?:v\d+)?(?=[\s[._-]|$)/i,
    );
    if (match)
      return Number(match[1]) === season && Number(match[2]) === episode;
    const ep = name.match(
      /(?:[ _]-[ _]|\bEpisode\s+|\bE)(\d{1,3})(?:v\d+)?(?=[\s[._-]|$)/i,
    );
    return ep ? Number(ep[1]) === episode : !requireNumber;
  };
  if (
    files.length === 1 &&
    !matches(String(files[0].filename || files[0].name || ""), false)
  )
    return [];
  const out = files.length <= 1 ? [...(torrent.attachments || [])] : [];
  for (const file of files)
    if (matches(String(file.filename || file.name || ""), files.length > 1))
      out.push(...(file.attachments || []));
  return [
    ...new Map(
      out.filter((a) => a.type === "subtitle").map((a) => [a.id, a]),
    ).values(),
  ];
}
function makeCues(content, explicitSigns = false) {
  const ass = /\[Events\]/i.test(content);
  const derived = ass ? deriveSignsSongsAss(content) : null;
  const text = derived?.count ? derived.content : explicitSigns ? content : "";
  return timingCues(text)
    .slice(0, 3000)
    .map((c) => ({
      start: c.start,
      end: c.end,
      text: c.text
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .slice(0, 1000),
    }))
    .filter(
      (c) =>
        Number.isFinite(c.start) &&
        c.start >= 0 &&
        Number.isFinite(c.end) &&
        c.end > c.start &&
        c.end - c.start <= 180 &&
        c.text.trim(),
    );
}
async function search(id, episode) {
  const key = id + ":" + episode,
    saved = cache.get(key);
  if (saved && Date.now() - saved.at < 300000) return saved.value;
  if (pending.has(key)) return pending.get(key);
  const work = (async () => {
    const signal = AbortSignal.timeout(25000);
    const mapping = await json(
      "https://api.ani.zip/mappings?anilist_id=" + id,
      signal,
    );
    if (Number(mapping.mappings?.anilist_id) !== id)
      throw new Error("Anime identity could not be verified");
    const info = mapping.episodes?.[String(episode)],
      eid = Number(info?.anidbEid);
    if (!Number.isSafeInteger(eid) || eid <= 0)
      return {
        tracks: [],
        message: "No episode mapping is available for subtitle search.",
      };
    const season = Number(info.seasonNumber) || 1;
    const tracks = [];
    let reached = false;
    for (const host of ["feed.animetosho.xyz", "feed.animetosho.org"]) {
      try {
        const feed = await json(
          "https://" +
            host +
            (host.endsWith(".xyz") ? "/feed/json" : "/json") +
            "?eid=" +
            eid,
          signal,
        );
        if (!Array.isArray(feed)) throw new Error("Invalid subtitle response");
        reached = true;
        const entries = feed
          .filter(
            (e) =>
              Number(e.anidb_eid) === eid &&
              (!e.status || e.status === "complete"),
          )
          .sort(
            (a, b) =>
              Number(/dual|dub|multi.?audio/i.test(b.title || "")) -
              Number(/dual|dub|multi.?audio/i.test(a.title || "")),
          )
          .slice(0, 6);
        for (
          let offset = 0;
          offset < entries.length && !tracks.length;
          offset += 3
        ) {
          const results = await Promise.allSettled(
            entries.slice(offset, offset + 3).map(async (entry) => {
              if (!Number.isSafeInteger(Number(entry.id))) return [];
              const torrent = await json(
                "https://" + host + "/json?show=torrent&id=" + entry.id,
                signal,
              );
              const out = [];
              for (const a of episodeAttachments(
                torrent,
                episode,
                season,
              ).slice(0, 8)) {
                const meta = a.info || {},
                  label = String(meta.name || meta.title || "English");
                if (
                  !/^(eng|en|english)$/i.test(
                    String(
                      meta.lang || meta.language_code || meta.language || "",
                    ),
                  ) &&
                  !/\benglish\b/i.test(label)
                )
                  continue;
                const n = Number(a.id);
                if (!Number.isSafeInteger(n) || n <= 0) continue;
                const explicit = /signs?|songs?|lyrics?|karaoke/i.test(label);
                const type = String(
                  meta.codec || meta.format || "ass",
                ).toLowerCase();
                if (!explicit && !/ass|ssa/.test(type)) continue;
                try {
                  const url =
                    a.url ||
                    "https://animetosho.org/storage/attach/" +
                      n.toString(16).padStart(8, "0") +
                      "/subtitle.ass.xz";
                  const bytes = await read(url, signal);
                  const content =
                    bytes.subarray(0, 6).toString("hex") === "fd377a585a00"
                      ? require("./seasubs-xz.cjs").decode(bytes)
                      : bytes.toString("utf8");
                  const cues = makeCues(content, explicit);
                  if (cues.length)
                    out.push({
                      id: String(n),
                      label:
                        (explicit ? label : "Signs & Songs (extracted)") +
                        " · " +
                        String(entry.title || "Subtitle release").slice(0, 180),
                      cues,
                    });
                } catch {
                  /* One unavailable attachment must not replace a working track. */
                }
                if (out.length >= 2) break;
              }
              return out;
            }),
          );
          for (const result of results)
            if (result.status === "fulfilled") tracks.push(...result.value);
        }
        if (tracks.length) break;
      } catch {
        if (signal.aborted) break;
      }
    }
    if (!reached)
      throw new Error(
        "Subtitle sources are unavailable. Please try again later.",
      );
    const value = {
      tracks: [
        ...new Map(tracks.map((track) => [track.id, track])).values(),
      ].slice(0, 6),
      message: tracks.length
        ? "Timing is unverified. Adjust it to match this video."
        : "No readable English Signs & Songs track was found for this episode.",
    };
    if (cache.size >= 50) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), value });
    return value;
  })().finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  const u = new URL(req.url, "http://localhost"),
    id = Number(u.searchParams.get("id")),
    episode = Number(u.searchParams.get("episode"));
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(episode) ||
    episode < 1 ||
    episode > 10000
  ) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid anime or episode" }));
    return;
  }
  try {
    res.end(JSON.stringify(await search(id, episode)));
  } catch {
    res.statusCode = 502;
    res.end(
      JSON.stringify({
        error: "Subtitle search is unavailable. Please try again later.",
      }),
    );
  }
}
module.exports = { handler, search, makeCues, episodeAttachments, allowed };
