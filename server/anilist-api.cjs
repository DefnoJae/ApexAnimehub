const relayUrl = "https://apexanime-oauth-relay.vercel.app/api/exchange";

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
  const request = (key) => fetch(key ? relayUrl : "https://graphql.anilist.co", {
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

module.exports = { cloudflareAniListRelayKey, fetchAniListGraphql, fetchWithAniListRelay, relayUrl };
