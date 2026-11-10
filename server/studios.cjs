// Resolve only the exact AniList studio; never accept client company names.
const cache = new Map(),
  pending = new Map();
const normalize = (name) =>
  String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function companyMatch(studio, company) {
  return !!normalize(studio) && normalize(studio) === normalize(company);
}
async function json(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Studio provider unavailable");
  return response.json();
}
async function studioLogo(id) {
  const saved = cache.get(id);
  if (saved && saved.expires > Date.now()) return saved.data;
  if (pending.has(id)) return pending.get(id);
  const request = (async () => {
    const payload = await json("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query($id:Int!){Studio(id:$id){id name isAnimationStudio}}",
        variables: { id },
      }),
    });
    const studio = payload.data?.Studio;
    if (
      payload.errors?.length ||
      studio?.id !== id ||
      !studio.isAnimationStudio
    )
      throw new Error("Studio unavailable");
    const token = process.env.TMDB_READ_ACCESS_TOKEN,
      key = process.env.TMDB_API_KEY;
    if (!token && !key) throw new Error("Studio images unavailable");
    const params = new URLSearchParams({ query: studio.name });
    if (!token) params.set("api_key", key);
    const companies = await json(
      "https://api.themoviedb.org/3/search/company?" + params,
      { headers: token ? { Authorization: "Bearer " + token } : {} },
    );
    const company = (companies.results || []).find(
      (company) =>
        companyMatch(studio.name, company.name) &&
        /^\/[A-Za-z0-9_.-]+\.(png|svg|webp)$/i.test(company.logo_path || ""),
    );
    const data = {
      id,
      name: studio.name,
      logo: company
        ? "https://image.tmdb.org/t/p/original" + company.logo_path
        : null,
    };
    if (cache.size >= 300) cache.delete(cache.keys().next().value);
    cache.set(id, {
      data,
      expires: Date.now() + (data.logo ? 21600000 : 900000),
    });
    return data;
  })();
  pending.set(id, request);
  try {
    return await request;
  } finally {
    pending.delete(id);
  }
}
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  const raw = new URL(req.url, "https://localhost").searchParams.get("id");
  const id = Number(raw);
  if (!/^\d+$/.test(raw || "") || !Number.isSafeInteger(id) || id < 1) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Invalid studio" }));
  }
  try {
    const data = await studioLogo(id);
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${data.logo ? 21600 : 900}, stale-while-revalidate=3600`,
    );
    return res.end(JSON.stringify(data));
  } catch {
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    return res.end(
      JSON.stringify({ error: "Studio images temporarily unavailable" }),
    );
  }
}
module.exports = { handler, studioLogo, companyMatch };
