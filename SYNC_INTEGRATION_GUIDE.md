# Account connections and list syncing

## Server setup

Use Node 20+ and copy .env.local.example to .env.local. Set APP_ORIGIN to the exact app origin and configure both providers' client IDs and registered callback URLs. AniList requires ANILIST_CLIENT_SECRET. MAL_CLIENT_SECRET is required for a confidential web-client registration; omit it only for a compatible public client. No secrets belong in REACT_APP_* variables. Rotate any previously published AniList secret.

Start the backend with node --env-file=.env.local server/oauth.cjs, and the app with npm start. Development uses the CRA proxy to port 3001. In production, serve the frontend and route /api/oauth/* and /api/list/* to the backend on the SAME origin over HTTPS. The backend binds to loopback for a reverse proxy. Register that origin's /api/oauth/anilist/callback and /api/oauth/mal/callback with the respective provider.

Both dashboard connections use authorization-code exchange on the server, with one-use state expiring after ten minutes, HttpOnly SameSite cookies, Origin checks on POST, bounded bodies and upstream timeouts. MAL uses a cryptographically random 64-character plain PKCE verifier for provider compatibility and refreshes expired access tokens server-side. Tokens never enter dashboard browser storage. Both account connections coexist in a session; disconnecting one retains the other. Local standalone sessions are in memory. Vercel uses encrypted authenticated cookies that survive instance changes; see VERCEL_SETUP.md for deployment settings and session limits.

## User flow

Open Settings, connect AniList and/or MyAnimeList, and return to the app. Connection results appear in Settings. Save Planning, Watching, Completed, On hold or Dropped from anime details to all connected accounts. Status-only updates preserve existing progress; Completed also records the episode total when known. List updates use AniList's id and its confirmed idMal mapping, never a guessed cross-provider ID. Each provider returns its own success/error feedback.

Automatic watching sync is enabled by default and can be disabled in Settings. Trusted playback position must reach 80% of a known, positive duration before the current episode is recorded once. Starting, closing, skipping forward or backward, and completion messages without position/duration do not record progress. A new source or episode resets the tracking guard. Actual provider progress is never lowered; automatic updates preserve existing Completed status and mark the final episode Completed only when its total is known. Provider calls run concurrently with individual results.

The player retains the embed's native controls without a playback overlay. N selects the next episode, B selects the previous episode, and F toggles host fullscreen. Fullscreen and Close buttons sit in a small header outside the video and disappear in fullscreen. The iframe allows native fullscreen and picture-in-picture. Keyboard focus is returned to the host after mouse interaction because cross-origin iframe keyboard events cannot bubble to the parent. The iframe element is retained across navigation and fullscreen is restored after source load when permitted by the browser. If a slow load outlasts browser user activation and restoration is denied, press F to restore fullscreen. Standard embed keyboard control focus is replaced by the host shortcuts; native controls remain usable with the mouse. Editable parent inputs, modifier combinations and repeated key presses are ignored.

## Other integration APIs

The older MALClient and OAuth utility are retained for existing library callers, but the dashboard uses the server routes above instead of their browser-token flow. Kitsu is not exposed in account settings in this update. Its published docs specify https://kitsu.io/api/oauth/token, password grant, and a token response without user_id; its client resolves /users?filter[self]=true before saving credentials, and library lookup failures fail syncing rather than attempting duplicate creation.

Sources: https://github.com/AniList/docs ; https://myanimelist.net/apiconfig/references/authorization ; https://myanimelist.net/apiconfig/references/api/v2 ; https://github.com/hummingbird-me/api-docs/blob/master/apiary.apib

## Verification

Run npm run typecheck, npm run test:ci, npm run test:server and npm run build. Account integration tests use mocked provider responses and verify dual connections, state rejection, per-account logout, status mappings and progress preservation. Live account authorization requires configured credentials and user login.
