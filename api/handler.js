const { nativeDub, isNativeDub } = require("../server/native-dub.cjs");
const { handler } = require("../server/vercel.cjs");
module.exports = (req, res) => {
  const url = new URL(req.url, "https://localhost");
  const route = req.query?.route || url.searchParams.get("route");
  if (typeof route === "string" && route.startsWith("/api/")) {
    url.searchParams.delete("route");
    req.url = route + (url.searchParams.size ? "?" + url.searchParams : "");
  }
  const playbackUrl = new URL(req.url, "https://localhost");
  if (isNativeDub(playbackUrl)) return nativeDub(req, res, playbackUrl);
  const { pathname } = playbackUrl;
  if ((pathname === "/api/artwork" || pathname === "/api/reanime-embed") &&
      req.headers.origin === "https://apexanime.pages.dev") {
    res.setHeader("Access-Control-Allow-Origin", "https://apexanime.pages.dev");
    res.setHeader("Vary", "Origin");
  }
  if (pathname === "/api/playback")
    return require("../server/playback.cjs").handler(req, res);
  if (new URL(req.url, "https://localhost").pathname === "/api/artwork")
    return require("../server/artwork.cjs").handler(req, res);
  if (
    new URL(req.url, "https://localhost").pathname === "/api/episode-metadata"
  )
    return require("../server/episodes.cjs").handler(req, res);
  if (new URL(req.url, "https://localhost").pathname === "/api/studio-logo")
    return require("../server/studios.cjs").handler(req, res);
  if (new URL(req.url, "https://localhost").pathname === "/api/presence")
    return require("../server/presence.cjs").handler(req, res);
  return handler(req, res);
};
