# SignSync

SignSync adapts the user's [SeaSubs](https://github.com/DefnoJae/SeaSubs) for ApexAnimehub. `signsync-text.cjs` reuses its VTT/SRT/ASS parsing, drawing exclusion, and Signs & Songs extraction helpers. `seasubs-xz.cjs` is the bundled subtitle-only decoder from `scripts/xz.js` and `scripts/xz-checks.js`, built with esbuild 0.25.12 and xz-compat 1.2.10. The original decoder sources and third-party notices are retained here. No new runtime dependency or video downloader is installed.

The decoder bundle must be rebuilt with SeaSubs' buffer shims (`seasubs-xz-buffer-inject.js` and `seasubs-xz-buffer-shim.js`). Without them the bundle pulls in `extract-base-iterator`/`readable-stream`, whose dynamic `require("stream")` is rejected by Cloudflare Workers and makes every XZ attachment fail. With the shims the bundle has no CommonJS `require` at all. To regenerate it from the repo root:

```
npm install --no-save --package-lock=false esbuild@0.25.12 xz-compat@1.2.10 buffer@6.0.3
npx esbuild server/seasubs-xz.mjs --bundle --platform=browser --format=cjs --target=es2018 \
  --inject:server/seasubs-xz-buffer-inject.js \
  --alias:extract-base-iterator=server/seasubs-xz-buffer-shim.js \
  --alias:xz-compat/dist/esm/lzma/sync/Lzma2Decoder.js=./node_modules/xz-compat/dist/esm/lzma/sync/Lzma2Decoder.js \
  --outfile=server/seasubs-xz.cjs
```

`signsync.test.cjs` executes the bundle in a VM with no `require`, so a Node-only decoder cannot be shipped again.

The GET endpoint accepts only an AniList ID and episode number. It verifies the ani.zip mapping and AniDB episode ID, checks indexed releases and individual batch filenames, and reads English text subtitle attachments. It never accepts an arbitrary download URL from the client. Requests, redirects, file sizes, decompressed output, cache size and search time are bounded. Successful searches are shared and cached for five minutes. Failed downloads do not become tracks.

Ani.pm exposes playback timestamps but not external track injection. The browser therefore renders a separate, synchronized text layer in the parent fullscreen container; Apex Player uses its native playback clock. Source video, audio, quality, original subtitle selection and watch tracking remain untouched. This integration is offered on Ani.pm and Apex Player, not unverified iframe sources. The top-bar button and settings panel hide in fullscreen; active text continues rendering. Settings are isolated by anime and sub/dub mode, while tracks are isolated by episode. Following episodes never reuses the preceding episode's cues.

Timing remains unverified because different releases can use different cuts. Users can adjust a saved delay. ASS tracks retain source styles, positions, colors, outlines, drawings and animation, rendered through a local libass-wasm canvas. Bounded, readable font attachments are used when available; missing typefaces use Noto Sans. VTT/SRT tracks and renderer failures retain the plain-text fallback. The first version searches episode-indexed AnimeTosho attachments; it does not port Seanime-only APIs, Nyaa fallback discovery, private OpenSubtitles credentials, or automatic per-cue comparison against unreadable iframe captions. Missing mappings, sources or readable signs are reported without changing playback. No subtitles or signed download URLs are stored in this repository or browser storage.

Run `npm run test:server` for extraction, file matching, host restrictions, cache, integrity and request validation checks. Frontend tests cover timed visibility, fullscreen panel cleanup and real-ID personal rating lookup.

