# Vercel deployment and account setup

The checked-in vercel.json deploys the React build plus api/handler.js. All /api/* requests reach the same-origin OAuth/list service. No separate long-running backend is needed on Vercel.

In Project Settings > Environment Variables, add these for the Preview environment (and Production when deploying there):

- APP_ORIGIN: the exact HTTPS origin used by users, without a trailing slash.
- SESSION_SECRET: a random 32-byte server secret, retained across deployments.
- ANILIST_CLIENT_ID and ANILIST_CLIENT_SECRET: from your AniList developer application.
- ANILIST_REDIRECT_URI: APP_ORIGIN plus /api/oauth/anilist/callback.
- MAL_CLIENT_ID and MAL_CLIENT_SECRET: from your MAL Web application.
- MAL_REDIRECT_URI: APP_ORIGIN plus /api/oauth/mal/callback.

Register those exact redirect URIs with the providers. The current branch alias is https://apex-animehub-2ljy-git-codex-apex-v1-cleanup-apex-anime-dev.vercel.app. Keep this origin stable: switching to another deployment hostname requires matching provider callbacks and APP_ORIGIN. Do not put any secret in REACT_APP_* variables, chat, commits or screenshots.

Redeploy after saving variables. Open /api/accounts: it reports only configured/connected flags and callback URLs. In Settings, Connect becomes available once configuration exists. Authorize each provider, then save a list status from anime details and verify the change on that provider. Real-account verification needs user authorization; automated tests mock upstream providers.

Vercel sessions use AES-256-GCM authenticated, encrypted HttpOnly Secure SameSite=Lax cookies, split to fit cookie size limits. Tokens are inaccessible to dashboard JavaScript. Pending OAuth state expires in ten minutes; sessions expire in one day. They survive process restarts without an in-memory session dependency. Logout clears this browser's account session; global revocation requires disconnecting the application at the provider. Cookie updates may conflict if separate tabs change account connections simultaneously. Per-anime server locks serialize updates within one instance; dashboard updates are queued, but separate clients/instances can still race.

For local development use Node 20+, copy .env.local.example to .env.local, fill it, start node --env-file=.env.local server/oauth.cjs and npm start. Local standalone sessions remain in memory. Secrets stay on the server.

The player retains native embed controls with no playback overlay. N/B select next/previous episodes; F and an outside-video header button enter host fullscreen. Fullscreen and picture-in-picture are permitted on the iframe. Host keyboard focus enables shortcuts after mouse interaction. Browsers can reject fullscreen restoration if a slow source load outlasts user activation; press F in that case. Tracking requires a trusted active-frame time message at or above 80% of a positive episode duration, once per episode/source. Opening or skipping an episode does not update list progress.

Dub schedules load every displayed ISO week from AsunaTracks' public AnimeSchedule timetable using the browser timezone. Calendar cells include all returned entries without a four-entry cutoff. Each week has a ten-minute cache and stale fallback; Refresh bypasses fresh caches. Source errors and last retrieval time are visible. Availability and date accuracy depend on the upstream timetable; unannounced releases cannot be inferred. MAL IDs are mapped through AniList before opening details; Asuna's internal IDs are never used as AniList IDs.
