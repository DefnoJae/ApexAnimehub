const { resolvePlayback, serveMedia } = require("./reanime.cjs");

async function nativeDub(req, res, url) {
  const relay = url.searchParams.get("media");
  if (relay !== null) return serveMedia(req, res, relay);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const id = Number(url.searchParams.get("id"));
  const episode = Number(url.searchParams.get("episode"));
  if (req.method !== "GET" || !Number.isSafeInteger(id) || id < 1 ||
      !Number.isSafeInteger(episode) || episode < 1 || episode > 10000) {
    res.statusCode = req.method === "GET" ? 400 : 405;
    return res.end(JSON.stringify({ error: "Invalid dub playback request." }));
  }

  try {
    return res.end(JSON.stringify(await resolvePlayback(id, episode, "dub")));
  } catch {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: "English dub is unavailable for this episode." }));
  }
}

function isNativeDub(url) {
  return url.pathname === "/api/playback" &&
    (url.searchParams.has("media") || url.searchParams.get("audio") === "dub");
}

module.exports = { nativeDub, isNativeDub };
