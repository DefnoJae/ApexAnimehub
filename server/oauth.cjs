// Same-origin OAuth service. Both providers' credentials stay on the server.
const http = require("node:http");
const { aniListRelayUrl, cloudflareAniListRelayKey, fetchAniListGraphql, fetchWithAniListRelay } = require("./anilist-api.cjs");
const { randomBytes } = require("node:crypto");
const {
  updateList,
  deleteList,
  readPublicRating,
  readList,
  readEntry,
  validateUpdate,
} = require("./list.cjs");
const origin =
  process.env.APP_ORIGIN ||
  (process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
    ? "https://" + (process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL)
    : "http://localhost:3000");
const SESSION_AGE = 365 * 24 * 60 * 60;
const sessions = new Map();
const locks = new Map();
const token = () => randomBytes(32).toString("hex");
function cookie(res, id, age = SESSION_AGE) {
  res.setHeader(
    "Set-Cookie",
    "apex_session=" +
      id +
      "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" +
      age +
      (origin.startsWith("https:") ? "; Secure" : ""),
  );
}
// AniList's implicit grant returns the token in the URL fragment, which never
// reaches this server. Tiny same-origin pages keep the login state in browser
// storage, then transfer the token to that storage without any token exchange.
const ANILIST_STATE_KEY = "apex_anilist_oauth_state_v1";
function scriptString(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function anilistImplicitStartPage(clientId) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Connecting AniList…</title></head>
<body>
<p>Connecting AniList…</p>
<script>
(function () {
  var bytes = new Uint8Array(24);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  var state = "";
  for (var j = 0; j < bytes.length; j++) state += ("0" + bytes[j].toString(16)).slice(-2);
  var params = new URLSearchParams({
    client_id: ${scriptString(clientId)},
    response_type: "token",
    state: state
  });
  try {
    localStorage.setItem(${JSON.stringify(ANILIST_STATE_KEY)}, JSON.stringify({
      state: state,
      expiresAt: Date.now() + 600000
    }));
  } catch (error) {
    window.location.replace("/?oauth=anilist&result=failed");
    return;
  }
  window.location.replace("https://anilist.co/api/v2/oauth/authorize?" + params);
})();
</script>
</body>
</html>`;
}
function anilistImplicitPage() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Connecting AniList…</title></head>
<body>
<p>Connecting AniList…</p>
<script>
(function () {
  var key = ${JSON.stringify(ANILIST_STATE_KEY)};
  var params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  var marker = null;
  var consumed = false;
  function consume() {
    if (consumed) return;
    consumed = true;
    try { localStorage.removeItem(key); } catch (error) {}
  }
  function finish(result) {
    consume();
    window.location.replace("/?oauth=anilist&result=" + result);
  }
  try {
    marker = JSON.parse(localStorage.getItem(key) || "null");
  } catch (error) {}
  var validMarker = marker && typeof marker.state === "string" &&
    /^[A-Za-z0-9._~-]{1,256}$/.test(marker.state) &&
    Number(marker.expiresAt) > Date.now();
  if (!validMarker) return finish("failed");
  var fragmentState = params.get("state");
  if (fragmentState && fragmentState !== marker.state) return finish("failed");
  if (params.get("error")) return finish("denied");
  var accessToken = params.get("access_token");
  if (!accessToken || !/^[A-Za-z0-9._~-]{1,4096}$/.test(accessToken)) return finish("failed");
  var seconds = Number(params.get("expires_in"));
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = 31536000;
  try {
    localStorage.setItem("apex_anilist_token_v1", JSON.stringify({
      accessToken: accessToken,
      expiresAt: Date.now() + seconds * 1000
    }));
  } catch (error) {
    return finish("failed");
  }
  finish("connected");
})();
</script>
</body>
</html>`;
}
async function body(req) {
  if (req.body !== undefined) {
    const serialized =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (serialized.length > 32768) throw new Error("Request too large");
    return JSON.parse(serialized);
  }
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 32768) throw new Error("Request too large");
  }
  return JSON.parse(data);
}
function config(provider) {
  const prefix = provider === "mal" ? "MAL" : "ANILIST";
  return {
    clientId: process.env[prefix + "_CLIENT_ID"]?.trim(),
    secret: process.env[prefix + "_CLIENT_SECRET"]?.trim(),
    redirect:
      process.env[prefix + "_REDIRECT_URI"] ||
      origin + "/api/oauth/" + provider + "/callback",
    tokenUrl:
      provider === "mal"
        ? "https://myanimelist.net/v1/oauth2/token"
        : "https://anilist.co/api/v2/oauth/token",
  };
}
async function accessAccount(session, provider) {
  const account = session?.accounts?.[provider];
  if (!account) return null;
  if (account.expiresAt > Date.now() + 60000) return account;
  if (provider !== "mal" || !account.refreshToken) {
    delete session.accounts[provider];
    return null;
  }
  if (!account.refreshing)
    account.refreshing = (async () => {
      const cfg = config("mal");
      const response = await fetch(cfg.tokenUrl, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
          client_id: cfg.clientId,
          ...(cfg.secret ? { client_secret: cfg.secret } : {}),
        }).toString(),
      });
      const data = await response.json();
      if (
        !response.ok ||
        typeof data.access_token !== "string" ||
        !Number.isFinite(data.expires_in)
      ) {
        const error = new Error(
          data.error === "invalid_grant"
            ? "MAL authorization expired. Please reconnect."
            : "MAL is temporarily unavailable. Please retry.",
        );
        error.revoked = data.error === "invalid_grant";
        throw error;
      }
      account.accessToken = data.access_token;
      account.refreshToken = data.refresh_token || account.refreshToken;
      account.expiresAt = Date.now() + data.expires_in * 1000;
    })().finally(() => {
      delete account.refreshing;
    });
  try {
    await account.refreshing;
    return account;
  } catch (error) {
    if (error.revoked) delete session.accounts.mal;
    throw error;
  }
}
function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const url = new URL(req.url, origin);
    if (url.pathname === "/api/presence")
      return require("./presence.cjs").handler(req, res);
    if (url.pathname === "/api/signsync")
      return require("./signsync.cjs").handler(req, res);
    if (url.pathname === "/api/playback")
      return require("./playback.cjs").handler(req, res);
    if (url.pathname === "/api/studio-logo")
      return require("./studios.cjs").handler(req, res);
    if (url.pathname === "/api/artwork")
      return require("./artwork.cjs").handler(req, res);
    if (url.pathname === "/api/episode-metadata")
      return require("./episodes.cjs").handler(req, res);
    const id = /(?:^|; )apex_session=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie || "",
    )?.[1];
    if (sessions.get(id)?.expiresAt < Date.now()) sessions.delete(id);
    const current = sessions.get(id);
    if (current && Object.keys(current.accounts || {}).length) {
      current.expiresAt = Date.now() + SESSION_AGE * 1000;
      cookie(res, id);
    }
    const send = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === "POST" && req.headers.origin !== origin)
        return send(403, { error: "Invalid origin" });
      if (url.pathname === "/api/accounts" && req.method === "GET") {
        const info = {};
        for (const provider of ["anilist", "mal"]) {
          const cfg = config(provider);
          info[provider] = {
            configured:
              req.apexSessionReady !== false &&
              !!cfg.clientId &&
              (provider !== "anilist" || !!cfg.secret),
            callback: cfg.redirect,
            connected: !!(await accessAccount(current, provider)),
          };
        }
        return send(200, { providers: info });
      }
      const route =
        /^\/api\/oauth\/(anilist|mal)\/(start|callback|session|logout|graphql|token|implicit)$/.exec(
          url.pathname,
        );
      if (route) {
        const [, provider, action] = route;
        const cfg = config(provider);
        if (action === "token" && provider === "mal")
          return send(404, { error: "Not found" });
        if (action === "implicit" && provider !== "anilist")
          return send(404, { error: "Not found" });
        if (provider === "anilist" && action === "implicit" && req.method === "GET") {
          if (
            req.headers.host === "apexanime.vercel.app" &&
            origin !== "https://apexanime.vercel.app"
          ) {
            res.writeHead(302, { Location: origin + url.pathname });
            return res.end();
          }
          if (!cfg.clientId || !cfg.redirect)
            return send(503, { error: "AniList OAuth server is not configured" });
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          });
          return res.end(anilistImplicitStartPage(cfg.clientId));
        }
        if (
          provider === "anilist" &&
          action === "callback" &&
          req.method === "GET" &&
          !url.searchParams.has("code") &&
          !url.searchParams.has("error")
        ) {
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          });
          return res.end(anilistImplicitPage());
        }
        if (action === "start" && req.method === "GET") {
          // The short public alias uses the registered OAuth host for account sessions.
          if (
            req.headers.host === "apexanime.vercel.app" &&
            origin !== "https://apexanime.vercel.app"
          ) {
            res.writeHead(302, { Location: origin + url.pathname });
            return res.end();
          }
          if (
            req.apexSessionReady === false ||
            !cfg.clientId ||
            !cfg.redirect ||
            (provider === "anilist" && !cfg.secret)
          )
            return send(503, {
              error: provider + " OAuth server is not configured",
            });
          // Retain the other provider when connecting a second account.
          const nextId = id && current ? id : token();
          const session = current || {
            accounts: {},
            pending: {},
            expiresAt: Date.now() + SESSION_AGE * 1000,
          };
          const state = token(),
            verifier = token();
          session.pending[provider] = {
            state,
            verifier,
            expiresAt: Date.now() + 600000,
          };
          sessions.set(nextId, session);
          cookie(res, nextId);
          const params = new URLSearchParams({
            client_id: cfg.clientId,
            redirect_uri: cfg.redirect,
            response_type: "code",
            state,
          });
          if (provider === "mal") {
            params.set("code_challenge", verifier);
            params.set("code_challenge_method", "plain");
          }
          res.writeHead(302, {
            Location:
              (provider === "mal"
                ? "https://myanimelist.net/v1/oauth2/authorize?"
                : "https://anilist.co/api/v2/oauth/authorize?") + params,
          });
          return res.end();
        }
        if (action === "callback" && req.method === "GET") {
          const pending = current?.pending?.[provider];
          if (
            !pending ||
            pending.expiresAt < Date.now() ||
            url.searchParams.get("state") !== pending.state
          )
            return send(400, { error: "Invalid or expired OAuth state" });
          delete current.pending[provider];
          const redirectBack = (result) => {
            res.writeHead(302, {
              Location: origin + "/?oauth=" + provider + "&result=" + result,
            });
            res.end();
          };
          if (!url.searchParams.get("code") || url.searchParams.has("error"))
            return redirectBack("denied");
          const fields = {
            grant_type: "authorization_code",
            client_id: cfg.clientId,
            redirect_uri: cfg.redirect,
            code: url.searchParams.get("code"),
            ...(cfg.secret ? { client_secret: cfg.secret } : {}),
            ...(provider === "mal" ? { code_verifier: pending.verifier } : {}),
          };
          const relayKey = provider === "anilist" ? cloudflareAniListRelayKey() : undefined;
          const exchange = (key) => fetch(key ? aniListRelayUrl() : cfg.tokenUrl, {
            method: "POST",
            signal: AbortSignal.timeout(key ? 75000 : 15000),
            redirect: "manual",
            headers: {
              Accept: "application/json",
              "Content-Type": provider === "anilist" ? "application/json" : "application/x-www-form-urlencoded",
              ...(key ? { Authorization: "Bearer " + key } : {}),
            },
            body: key ? JSON.stringify({ client_secret: cfg.secret, code: fields.code })
              : provider === "anilist" ? JSON.stringify(fields) : new URLSearchParams(fields).toString(),
          }).then((response) => {
            if (!response.ok) {
              console.warn("OAuth exchange request rejected", provider, key ? "relay" : "direct", response.status);
            }
            return response;
          });
          const response = await (relayKey
            ? fetchWithAniListRelay(() => exchange(relayKey), () => exchange())
            : exchange());
          if (!response.ok) {
            console.warn("OAuth token exchange rejected", provider, response.status,
              response.headers.get("cf-mitigated") === "challenge" ? "challenge" : "upstream");
            return redirectBack("failed");
          }
          const data = await response.json();
          if (
            typeof data.access_token !== "string" ||
            !Number.isFinite(data.expires_in) ||
            data.expires_in <= 0
          )
            return redirectBack("failed");
          current.accounts[provider] = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
          };
          const nextId = token();
          sessions.delete(id);
          sessions.set(nextId, current);
          cookie(res, nextId);
          return redirectBack("connected");
        }
        if (action === "logout" && req.method === "POST") {
          if (current) {
            delete current.accounts[provider];
            delete current.pending[provider];
          }
          return send(200, { success: true });
        }
        const account = await accessAccount(current, provider);
        if (action === "session" && req.method === "GET")
          return send(account ? 200 : 401, { authenticated: !!account });
        if (
          action === "token" &&
          provider === "anilist" &&
          req.method === "GET"
        ) {
          if (!account) return send(401, { error: "Not connected" });
          return send(200, {
            accessToken: account.accessToken,
            expiresAt: account.expiresAt,
            ...(account.identity?.id != null
              ? { identity: String(account.identity.id) }
              : {}),
          });
        }
        if (
          action === "graphql" &&
          provider === "anilist" &&
          req.method === "POST"
        ) {
          if (!account) return send(401, { error: "Not authenticated" });
          const payload = await body(req);
          if (typeof payload.query !== "string")
            return send(400, { error: "Missing query" });
          const upstream = await fetchAniListGraphql(account.accessToken, payload);
          if (upstream.status === 401) delete current.accounts[provider];
          return send(upstream.status, await upstream.json());
        }
      }
      if (url.pathname === "/api/ratings/mal" && req.method === "GET") {
        const animeId = Number(url.searchParams.get("animeId"));
        try {
          validateUpdate({ id: animeId, status: "watching" });
        } catch (error) {
          return send(400, { error: error.message });
        }
        const account = await accessAccount(current, "mal");
        if (!account && !process.env.MAL_CLIENT_ID)
          return send(401, { error: "MAL connection unavailable" });
        return send(200, { score: await readPublicRating(account, animeId) });
      }
      const listRoute = /^\/api\/list\/(anilist|mal)$/.exec(url.pathname);
      if (listRoute && req.method === "GET") {
        const provider = listRoute[1];
        const account = await accessAccount(current, provider);
        if (!account)
          return send(401, {
            error: "Please reconnect your " + provider + " account.",
          });
        if (url.searchParams.has("animeId"))
          return send(200, {
            entry: await readEntry(
              provider,
              account,
              Number(url.searchParams.get("animeId")),
            ),
          });
        return send(
          200,
          await readList(
            provider,
            account,
            Number(url.searchParams.get("page") || 1),
          ),
        );
      }
      if (listRoute && req.method === "POST") {
        const provider = listRoute[1];
        const account = await accessAccount(current, provider);
        if (!account)
          return send(401, {
            error: "Please connect your " + provider + " account.",
          });
        const input = await body(req);
        try {
          validateUpdate(
            input.action === "remove"
              ? { id: input.id, status: "watching" }
              : input,
          );
        } catch (error) {
          return send(400, { error: error.message });
        }
        const key = id + ":" + provider + ":" + input.id;
        const previous = locks.get(key) || Promise.resolve();
        const update = previous
          .catch(() => {})
          .then(() =>
            input.action === "remove"
              ? deleteList(provider, account, input.id)
              : updateList(provider, account, input),
          );
        locks.set(key, update);
        try {
          const result = await update;
          return send(
            200,
            input.action === "remove"
              ? { success: true, removed: result }
              : { success: true, entry: result },
          );
        } finally {
          if (locks.get(key) === update) locks.delete(key);
        }
      }
      send(404, { error: "Not found" });
    } catch (error) {
      send(502, { error: error.message || "OAuth service request failed" });
    }
  });
}
if (require.main === module) {
  const cleanup = setInterval(() => {
    for (const [id, session] of sessions)
      if (session.expiresAt < Date.now()) sessions.delete(id);
  }, 60000);
  cleanup.unref();
  createServer().listen(Number(process.env.PORT || 3001), "127.0.0.1");
}
module.exports = { createServer, sessions };
