import React, { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import type { useAccounts } from "../hooks/useAccounts";
import type { AudioLanguage, PlaybackSource } from "../hooks/usePageRoute";
import type { DashboardAnime } from "./HomeDashboard";
export interface PlayerProps {
  anime?: DashboardAnime;
  episodeCount?: number;
  watchedThrough?: number;
  audio?: AudioLanguage;
  onPlaybackSource?: (source: PlaybackSource, audio: AudioLanguage) => void;
  resume?: { position?: number; duration?: number };
  title: string;
  episode: number;
  stream: { url: string; name: string };
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onWatched: (episode?: number) => void;
  onProgress?: (position: number, duration: number, episode?: number) => void;
  onEpisodeChange?: (episode: number, lang: "sub" | "dub") => void;
  onClose: () => void;
  accounts: ReturnType<typeof useAccounts>;
}
export function trustedPlaybackMessage(
  event: MessageEvent,
  source: Window | null,
  origin: string,
): Record<string, unknown> | null {
  if (!source || event.source !== source || event.origin !== origin)
    return null;
  try {
    const data =
      typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : null;
  } catch {
    return null;
  }
}
const NativeVideoPlayer = React.lazy(() => import("./NativeVideoPlayer"));
const AniPmPlayer = React.lazy(() => import("./AniPmPlayer"));
export function VideoPlayer(props: PlayerProps) {
  if (
    new URL(props.stream.url, window.location.origin).origin ===
    "https://ani.pm"
  )
    return (
      <React.Suspense fallback={<p role="status">Loading Ani.pm player…</p>}>
        <AniPmPlayer
          key={new URL(props.stream.url).pathname.split("/")[3]}
          {...props}
        />
      </React.Suspense>
    );
  if (props.stream.url.startsWith("/api/reanime-embed?"))
    return <ReAnimePlayer {...props} />;
  const native = new URL(props.stream.url, window.location.origin).pathname === "/api/playback";
  if (native)
    return (
      <React.Suspense fallback={<p role="status">Loading player…</p>}>
        <NativeVideoPlayer {...props} />
      </React.Suspense>
    );
  return <EmbedVideoPlayer {...props} />;
}
function ReAnimePlayer(props: PlayerProps) {
  const request = props.stream.url;
  const [resolved, setResolved] = useState<{ request: string; url: string | null }>();
  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal, credentials: "omit" as const };
    fetch(request, options)
      .then((response) => {
        if (response.ok || window.location.hostname !== "apexanime.pages.dev") return response;
        return fetch("https://apexanime.vercel.app" + request, options);
      })
      .then(async (response) => {
        if (!response.ok) throw new Error("ReAnime lookup failed");
        const data = await response.json();
        const url = new URL(data.url);
        if (url.origin !== "https://flixcloud.cc") throw new Error("Invalid player URL");
        if (!controller.signal.aborted) setResolved({ request, url: url.href });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolved({ request, url: null });
      });
    return () => controller.abort();
  }, [request]);
  const current = resolved?.request === request ? resolved : undefined;
  return (
    <EmbedVideoPlayer
      {...props}
      stream={{ ...props.stream, url: current?.url ?? "about:blank" }}
      reAnimeStatus={current?.url ? "ready" : current ? "failed" : "loading"}
    />
  );
}

function EmbedVideoPlayer({
  anime,
  audio,
  onPlaybackSource,
  title,
  episode,
  stream,
  canNext,
  onPrevious,
  onNext,
  onWatched,
  onClose,
  onProgress,
  accounts,
  reAnimeStatus,
}: PlayerProps & { reAnimeStatus?: "loading" | "failed" | "ready" }) {
  const frame = useRef<HTMLDivElement>(null),
    iframe = useRef<HTMLIFrameElement>(null);
  const watched = useRef(false);
  const progressCallback = useRef(onProgress);
  progressCallback.current = onProgress;
  const lastProgress = useRef(0);
  const loaded = useRef(false);
  const restoreFullscreen = useRef(false);
  const restoreTimer = useRef<ReturnType<typeof setTimeout>>();
  const [fullscreen, setFullscreen] = useState(false),
    [error, setError] = useState("");
  const callbacks = useRef({
    onWatched,
    onPlaybackSource,
    autoSync: accounts.autoSync,
    onPrevious,
    onNext,
    onClose,
    canNext,
    episode,
  });
  callbacks.current = {
    onWatched,
    onPlaybackSource,
    autoSync: accounts.autoSync,
    onPrevious,
    onNext,
    onClose,
    canNext,
    episode,
  };
  const origin = new URL(stream.url, window.location.origin).origin;
  const focusShortcuts = () => frame.current?.focus({ preventScroll: true });
  const enterFullscreen = () => {
    focusShortcuts();
    void frame.current
      ?.requestFullscreen()
      .catch(() => setError("Fullscreen is unavailable in this browser."));
  };
  useEffect(() => {
    watched.current = false;
    loaded.current = false;
    lastProgress.current = 0;
    setError("");
    const listener = (event: MessageEvent) => {
      const data = trustedPlaybackMessage(
        event,
        iframe.current?.contentWindow || null,
        origin,
      );
      if (!data || !loaded.current) return;
      if (origin === "https://animeembed.com") {
        if (data.channel !== "animeembed" || data.version !== 1 ||
            Number(data.animeId) !== anime?.id || Number(data.episode) !== episode ||
            data.language !== audio) return;
        if (data.event === "error") {
          callbacks.current.onPlaybackSource?.("anipm", audio ?? "sub");
          return;
        }
        if (data.event !== "progress" || !data.data || typeof data.data !== "object") return;
        const progress = data.data as Record<string, unknown>;
        data.event = "time";
        data.currentTime = progress.currentTime;
        data.duration = progress.duration;
      }
      if (
        data.event === "time" ||
        data.event === "CURRENT_TIME" ||
        data.type === "watching-log"
      ) {
        const position = Number(data.time ?? data.currentTime),
          duration = Number(data.duration);
        if (
          Number.isFinite(position) &&
          Number.isFinite(duration) &&
          duration > 0 &&
          position >= 0 &&
          position <= duration &&
          (Date.now() - lastProgress.current >= 5000 ||
            position >= duration * 0.99)
        ) {
          lastProgress.current = Date.now();
          progressCallback.current?.(position, duration);
        }
        if (
          !watched.current &&
          callbacks.current.autoSync &&
          Number.isFinite(position) &&
          Number.isFinite(duration) &&
          duration > 0 &&
          position >= duration * 0.8 &&
          position <= duration + 5
        ) {
          watched.current = true;
          callbacks.current.onWatched();
        }
      }
      if (data.event === "error")
        setError(
          "The video source failed. Close the player and try another source.",
        );
    };
    window.addEventListener("message", listener);
    const poll = setInterval(() => {
      if (origin !== "null" && origin !== "https://animeembed.com" && origin !== "https://flixcloud.cc")
        iframe.current?.contentWindow?.postMessage({ cmd: "GET_TIME" }, origin);
    }, 1000);
    return () => {
      window.removeEventListener("message", listener);
      clearInterval(poll);
    };
  }, [stream.url, origin, anime?.id, episode, audio]);
  useEffect(() => {
    let reclaim: ReturnType<typeof setTimeout> | undefined;
    // Keyboard events cannot cross the provider's iframe. Keep shortcut focus on its host;
    // mouse interaction with the native video controls remains available.
    const blur = () => {
      reclaim = setTimeout(() => {
        if (document.activeElement === iframe.current) focusShortcuts();
      }, 0);
    };
    const changed = () => {
      setFullscreen(!!document.fullscreenElement);
      focusShortcuts();
      // Native iframe fullscreen hides the host and traps keyboard events in the
      // cross-origin document. Promote it immediately while the click is active.
      if (
        document.fullscreenElement === iframe.current &&
        frame.current?.requestFullscreen
      ) {
        void frame.current
          .requestFullscreen()
          .then(focusShortcuts)
          .catch(() =>
            setError(
              "Use F or the Fullscreen button above the player to enable episode shortcuts.",
            ),
          );
      }
      if (!document.fullscreenElement && restoreFullscreen.current) {
        restoreFullscreen.current = false;
        enterFullscreen();
      }
    };
    const navigate = (action: () => void) => {
      restoreFullscreen.current = !!document.fullscreenElement;
      // Promote iframe fullscreen to the persistent host before replacing an episode iframe.
      if (
        document.fullscreenElement &&
        document.fullscreenElement !== frame.current &&
        frame.current?.requestFullscreen
      )
        void frame.current.requestFullscreen().then(action).catch(action);
      else action();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]'))
        return;
      switch (event.key.toLowerCase()) {
        case "n":
          if (callbacks.current.canNext) {
            event.preventDefault();
            navigate(callbacks.current.onNext);
          }
          break;
        case "b":
          if (callbacks.current.episode > 1) {
            event.preventDefault();
            navigate(callbacks.current.onPrevious);
          }
          break;
        case "f":
          event.preventDefault();
          restoreFullscreen.current = false;
          if (document.fullscreenElement) void document.exitFullscreen();
          else enterFullscreen();
          break;
        case "escape":
          restoreFullscreen.current = false;
          if (!document.fullscreenElement) callbacks.current.onClose();
          break;
      }
    };
    focusShortcuts();
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", keyboard);
    document.addEventListener("fullscreenchange", changed);
    return () => {
      clearTimeout(reclaim);
      clearTimeout(restoreTimer.current);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", keyboard);
      document.removeEventListener("fullscreenchange", changed);
    };
  }, []);
  return (
    <div
      ref={frame}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Anime video player"
      className="fixed inset-0 z-[500] bg-black text-white flex flex-col outline-none"
    >
      {!fullscreen && (
        <div className="shrink-0 flex items-center gap-4 px-4 py-2 bg-zinc-950 text-sm">
          <span className="truncate flex-1">
            {title} · Episode {episode} · {stream.name}
            {origin === "https://flixcloud.cc" && audio === "dub" && " · Select English in Settings → Audio Tracks"}
          </span>
          <span className="text-zinc-400">
            N: Next · B: Previous · F: Fullscreen
          </span>
          <button onClick={enterFullscreen} aria-label="Fullscreen player">
            Fullscreen
          </button>
          <button onClick={onClose} aria-label="Close video player">
            Close
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="shrink-0 px-4 text-amber-300">
          {error}
        </p>
      )}
      {reAnimeStatus && reAnimeStatus !== "ready" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p role="status">
            {reAnimeStatus === "failed"
              ? "ReAnime could not load this episode."
              : "Loading ReAnime…"}
          </p>
          {reAnimeStatus === "failed" && (
            <button onClick={() => onPlaybackSource?.("anipm", audio ?? "sub")}>
              Use Ani.pm
            </button>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      )}
      {(!reAnimeStatus || reAnimeStatus === "ready") && <iframe
        key={origin === "https://animeembed.com" ? stream.url : undefined}
        ref={iframe}
        tabIndex={-1}
        onLoad={() => {
          loaded.current = true;
          focusShortcuts();
          if (restoreFullscreen.current && !document.fullscreenElement) {
            restoreFullscreen.current = false;
            enterFullscreen();
          }
          clearTimeout(restoreTimer.current);
          restoreTimer.current = setTimeout(() => {
            restoreFullscreen.current = false;
          }, 1000);
        }}
        title={title + " episode " + episode}
        src={stream.url}
        className="w-full flex-1 min-h-0 border-none"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />}
      {reAnimeStatus === "ready" && canNext && (
        <button
          type="button"
          onClick={onNext}
          aria-label="Next episode"
          title="Next episode (N)"
          className="absolute bottom-2 left-[min(14rem,48vw)] grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <SkipForward size={19} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
