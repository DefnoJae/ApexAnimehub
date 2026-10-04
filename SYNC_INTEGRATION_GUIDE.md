# Account connections and list syncing

## Server setup

Use Node 20+ and copy .env.local.example to .env.local. Set APP_ORIGIN to the exact app origin and configure both providers' client IDs and registered callback URLs. AniList requires ANILIST_CLIENT_SECRET. MAL_CLIENT_SECRET is required for a confidential web-client registration; omit it only for a compatible public client. No secrets belong in REACT_APP_* variables. Rotate any previously published AniList secret.

Start the backend with node --env-file=.env.local server/oauth.cjs, and the app with npm start. Development uses the CRA proxy to port 3001. In production, serve the frontend and route /api/oauth/* and /api/list/* to the backend on the SAME origin over HTTPS. The backend binds to loopback for a reverse proxy. Register that origin's /api/oauth/anilist/callback and /api/oauth/mal/callback with the respective provider.

Both dashboard connections use authorization-code exchange on the server, with one-use state expiring after ten minutes, HttpOnly SameSite cookies, Origin checks on POST, bounded bodies and upstream timeouts. MAL uses a cryptographically random 64-character plain PKCE verifier for provider compatibility and refreshes expired access tokens server-side. Tokens never enter dashboard browser storage. Both account connections coexist in a session; disconnecting one retains the other. Local standalone sessions are in memory. Vercel uses encrypted authenticated cookies that survive instance changes; see VERCEL_SETUP.md for deployment settings and session limits.

## User flow

Open Settings, connect AniList and/or MyAnimeList, and return to the app. Connection results appear in Settings. Save Planning, Watching, Completed, On hold or Dropped from anime details to all connected accounts. Status-only updates preserve existing progress; Completed also records the episode total when known. List updates use AniList's id and its confirmed idMal mapping, never a guessed cross-provider ID. Each provider returns its own success/error feedback.

Automatic watching sync is enabled by default and can be disabled in Settings. Starting playback marks Watching without counting an unfinished episode. Next episode records the episode being left before opening the next source. Mark watched records the current episode explicitly, including the final one, and marks Completed only when the actual total episode count is known. Progress reports never lower existing provider progress. Automatic playback updates preserve a provider's existing Completed status. Actions are queued, with provider calls run concurrently, and server updates to each anime are serialized.

The player is a third-party cross-origin iframe. ApexAnimehub supplies compact on-video controls with Next beside volume, Mark watched and Fullscreen within the player frame. Fullscreen uses the entire frame so these controls remain visible. MegaPlay supplies completion messages; ApexAnimehub validates the exact iframe window and origin before recording completion. Opening, pausing or closing it is not treated as proof of completion.

## Other integration APIs

The older MALClient and OAuth utility are retained for existing library callers, but the dashboard uses the server routes above instead of their browser-token flow. Kitsu is not exposed in account settings in this update. Its published docs specify https://kitsu.io/api/oauth/token, password grant, and a token response without user_id; its client resolves /users?filter[self]=true before saving credentials, and library lookup failures fail syncing rather than attempting duplicate creation.

Sources: https://github.com/AniList/docs ; https://myanimelist.net/apiconfig/references/authorization ; https://myanimelist.net/apiconfig/references/api/v2 ; https://github.com/hummingbird-me/api-docs/blob/master/apiary.apib

## Verification

Run npm run typecheck, npm run test:ci, npm run test:server and npm run build. Account integration tests use mocked provider responses and verify dual connections, state rejection, per-account logout, status mappings and progress preservation. Live account authorization requires configured credentials and user login.
