async function reanimeEmbed(req, res) {
  const url = new URL(req.url, "https://localhost");
  const id = Number(url.searchParams.get("id"));
  const episode = Number(url.searchParams.get("episode"));
  const audio = url.searchParams.get("audio");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" || !Number.isSafeInteger(id) || id < 1 ||
      !Number.isSafeInteger(episode) || episode < 1 || !["sub", "dub"].includes(audio)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Invalid episode request" }));
  }
  try {
    const response = await fetch(`https://reanime.cz/api/flix/${id}/${episode}`, {
      signal: AbortSignal.timeout(7500),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Episode lookup failed");
    const { servers } = await response.json();
    const entry = Array.isArray(servers) && servers.find(
      (server) => server?.serverName === "HD-1" && server.dataType === audio,
    );
    const embed = entry && new URL(entry.dataLink);
    if (embed?.origin === "https://flixcloud.cc" && !embed.username && !embed.password &&
        /^\/e\/[a-z0-9]+$/i.test(embed.pathname)) {
      return res.end(JSON.stringify({ url: embed.href }));
    }
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "Episode unavailable on ReAnime" }));
  } catch {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: "ReAnime lookup failed" }));
  }
}

module.exports = { reanimeEmbed };
