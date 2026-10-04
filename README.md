# ApexAnimehub

Anime discovery and playback dashboard with dub schedules and provider-sync integration APIs.

## Development

Use Node 20+ and npm ci --legacy-peer-deps, then npm start. Run npm run build, npm run typecheck, npm run test:ci and npm run test:server to validate changes.

See [SYNC_INTEGRATION_GUIDE.md](SYNC_INTEGRATION_GUIDE.md) for the same-origin AniList OAuth backend and provider compatibility notes. Account-connect and automatic sync UI are not wired into the dashboard yet.

The dub schedule caches the last valid response and shows stale/offline and last-updated states. Calendar headers start Monday; weekly view starts Sunday at local midnight.

The existing Create React App toolchain has known dependency audit findings. A build-tool migration is outside this cleanup; do not force-upgrade dependencies without checking compatibility.
