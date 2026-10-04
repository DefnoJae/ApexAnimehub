# Sync integration and OAuth

The dashboard does not yet include account-connect or automatic sync UI. The clients and SyncManager are integration APIs; caller settings use an authenticated marker rather than duplicating tokens.

## AniList: same-origin server authorization-code flow

Run the included Node 20+ backend with npm run oauth-server, loading the server environment (for example node --env-file=.env.local server/oauth.cjs). Development uses the CRA proxy to port 3001. In production route /api/oauth/anilist/* to this backend on the SAME origin over HTTPS. Set APP_ORIGIN to the exact public origin, ANILIST_CLIENT_ID, ANILIST_CLIENT_SECRET and ANILIST_REDIRECT_URI to that origin's /api/oauth/anilist/callback. Register the exact redirect with AniList. Never put a secret in REACT_APP_* variables. Rotate any previously published secret.

Navigate to aniListClient.getAuthorizationUrl(). The server generates a one-use state tied to an HttpOnly SameSite cookie, validates callbacks, exchanges codes and retains tokens in server memory. The browser receives only an opaque session cookie. authenticate() checks the session; authenticated GraphQL uses the same-origin backend. The server requires matching Origin on POST, bounds requests and times out upstream calls. Sessions expire after at most a day and are lost on restart. For multiple instances replace the in-memory store with a shared expiring store. The backend is bound to loopback for a reverse proxy.

## MAL

Use a public-client registration compatible with no secret; REACT_APP_MAL_CLIENT_ID and REACT_APP_MAL_REDIRECT_URI are public configuration. Keep plain PKCE for MAL compatibility; verifier is now 64 cryptographically random hex characters. State and verifier are per-tab session storage, state expires after ten minutes and is consumed once. Callback callers MUST pass both code and state to malClient.authenticate(code, state). Tokens remain browser-local for this existing client; if browser CORS blocks MAL, route token and API requests through a server rather than a public CORS proxy. The callback page is not supplied by the dashboard.

## Kitsu compatibility review

Published Kitsu docs specify https://kitsu.io/api/oauth/token, password grant, and a token response without user_id. Authentication now looks up /users?filter[self]=true before saving credentials. No password is persisted. Library lookup failures now fail syncing instead of attempting duplicate creation. Live account/CORS compatibility still needs an account-backed check.

Sources: https://github.com/AniList/docs/blob/master/docs/guide/auth/authorization-code.md ; https://myanimelist.net/apiconfig/references/authorization ; https://github.com/hummingbird-me/api-docs/blob/master/apiary.apib

## Sync results

syncEpisodeProgress runs enabled providers concurrently using Promise.allSettled. It returns a SyncStatus for every enabled provider, including missing mappings and rejected jobs. Notifications list individual failures. Callers can render these returned results in their account UI.
