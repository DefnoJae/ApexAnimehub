const { createHash } = require("node:crypto");

// Small, per-isolate cache for authenticated read queries. It prevents the
// opening screen and its entry editor from asking AniList for the same record
// at the same time, without persisting a user's list data anywhere.
const readCache = new Map();
const pendingReads = new Map();
const READ_CACHE_TTL = 20_000;

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
  const request = (key, timeout = key ? 75000 : 15000) => fetch(key ? aniListRelayUrl() : "https://graphql.anilist.co", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(timeout),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + (key || accessToken),
    },
    body: JSON.stringify(key ? { operation: "graphql", accessToken, payload } : payload),
  });
  const isRead = /^\s*(?:query\b|\{)/.test(payload.query);
  // Saving a media-list entry sets a complete desired state, so a retry after
  // a transport failure is safe. Other mutations remain single-shot.
  const isIdempotentSave = /\bSaveMediaListEntry\b/.test(payload.query);
  const cacheKey = isRead && process.env.APP_ORIGIN === "https://apexanime.pages.dev"
    ? createHash("sha256").update(accessToken).update("\0").update(JSON.stringify(payload)).digest("hex")
    : null;
  const cached = cacheKey && readCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now())
    return new Response(cached.body, { status: cached.status, headers: cached.headers });

  const execute = async () => {
    if (!relayKey) return request();

    const started = Date.now();
    const relay = await request(relayKey).catch(() => null);
    if (relay && ![402, 502, 503, 504].includes(relay.status)) return relay;

    // Try the provider directly when the relay itself is unavailable. Preserve
    // the relay's failure if the provider rejects Cloudflare's network.
    const direct = await request().catch(() => null);
    if (direct && ![403, 502, 503, 504].includes(direct.status)) {
      await relay?.body?.cancel();
      return direct;
    }
    const remaining = 75000 - (Date.now() - started);
    if ((isRead || isIdempotentSave) && remaining > 0) {
      const retry = await request(relayKey, Math.min(remaining, 30000)).catch(() => null);
      if (retry && ![402, 502, 503, 504].includes(retry.status)) {
        await relay?.body?.cancel();
        await direct?.body?.cancel();
        return retry;
      }
      await retry?.body?.cancel();
    }
    if (relay) {
      await direct?.body?.cancel();
      return relay;
    }
    if (direct) return direct;
    throw new Error("AniList is temporarily unavailable. Try again shortly.");
  };

  if (!cacheKey) return execute();
  const pending = pendingReads.get(cacheKey);
  if (pending) return pending.then((response) => response.clone());
  const requestPromise = execute().then(async (response) => {
    if (response.ok) {
      const body = await response.clone().text();
      if (body.length <= 262144) {
        readCache.set(cacheKey, {
          body,
          status: response.status,
          headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
          expiresAt: Date.now() + READ_CACHE_TTL,
        });
      }
    }
    return response;
  }).finally(() => pendingReads.delete(cacheKey));
  pendingReads.set(cacheKey, requestPromise);
  return requestPromise;
}

module.exports = { aniListRelayUrl, cloudflareAniListRelayKey, fetchAniListGraphql, fetchWithAniListRelay };

