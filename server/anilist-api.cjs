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

async function fetchAniListGraphql(accessToken, payload) {
  const relayKey = cloudflareAniListRelayKey();
  const request = (key) => fetch(key ? aniListRelayUrl() : "https://graphql.anilist.co", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(key ? 75000 : 15000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + (key || accessToken),
    },
    body: JSON.stringify(key ? { operation: "graphql", accessToken, payload } : payload),
  });
  if (!relayKey) return request();

  const relay = await request(relayKey).catch(() => null);
  if (relay && ![402, 502, 503, 504].includes(relay.status)) return relay;

  // Try the provider directly when the relay itself is unavailable. Preserve
  // the relay's failure if the provider rejects Cloudflare's network.
  const direct = await request().catch(() => null);
  if (direct && (!relay || ![403, 502, 503, 504].includes(direct.status))) {
    await relay?.body?.cancel();
    return direct;
  }
  if (relay) {
    await direct?.body?.cancel();
    return relay;
  }
  throw new Error("AniList is temporarily unavailable. Try again shortly.");
}

module.exports = { aniListRelayUrl, cloudflareAniListRelayKey, fetchAniListGraphql, fetchWithAniListRelay };
