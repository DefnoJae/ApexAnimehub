function aniListRelayUrl() {
  const configured = process.env.APEX_RELAY_URL;
  if (!configured) return "https://apexanime-oauth-relay.vercel.app/api/exchange";
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid AniList relay URL");
  }
  return url.href;
}

function cloudflareAniListRelayKey() {
  return process.env.APP_ORIGIN === "https://apexanime.pages.dev"
    ? process.env.APEX_RELAY_KEY
    : undefined;
}

async function fetchWithAniListRelay(relayRequest, directRequest) {
  const response = await relayRequest().catch(() => null);
  if (response && response.status !== 402) return response;
  await response?.body?.cancel();
  return directRequest();
}

function fetchAniListGraphql(accessToken, payload) {
  const relayKey = cloudflareAniListRelayKey();
  const request = (key) => fetch(key ? aniListRelayUrl() : "https://graphql.anilist.co", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + (key || accessToken),
    },
    body: JSON.stringify(key ? { operation: "graphql", accessToken, payload } : payload),
  });
  return relayKey ? fetchWithAniListRelay(() => request(relayKey), () => request()) : request();
}

module.exports = { aniListRelayUrl, cloudflareAniListRelayKey, fetchAniListGraphql, fetchWithAniListRelay };
