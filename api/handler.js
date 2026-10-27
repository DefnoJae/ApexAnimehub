const { handler } = require("../server/vercel.cjs");
module.exports = (req, res) => {
  const url = new URL(req.url, "https://localhost");
  const route = req.query?.route || url.searchParams.get("route");
  if (typeof route === "string" && route.startsWith("/api/")) {
    url.searchParams.delete("route");
    req.url = route + (url.searchParams.size ? "?" + url.searchParams : "");
  }
  if (new URL(req.url, "https://localhost").pathname === "/api/playback")
    return require("../server/playback.cjs").handler(req, res);
  if (new URL(req.url, "https://localhost").pathname === "/api/artwork") return require("../server/artwork.cjs").handler(req, res);
  return handler(req, res);
};
