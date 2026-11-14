const relayUrl = "https://apexanime-oauth-relay.vercel.app/api/exchange";

function cloudflareAniListRelayKey() {
  return process.env.APP_ORIGIN === "https://apexanime.pages.dev"
    ? process.env.APEX_RELAY_KEY
    : undefined;
}

function fetchAniListGraphql(accessToken, payload) {
  const relayKey = cloudflareAniListRelayKey();
  return fetch(relayKey ? relayUrl : "https://graphql.anilist.co", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + (relayKey || accessToken),
    },
    body: JSON.stringify(relayKey ? { operation: "graphql", accessToken, payload } : payload),
  });
}

module.exports = { cloudflareAniListRelayKey, fetchAniListGraphql, relayUrl };
