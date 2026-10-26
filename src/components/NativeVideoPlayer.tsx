import React, { useEffect, useRef, useState } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import type { PlayerProps } from "./VideoPlayer";
import "./nativeVideoPlayer.css";
function controlButton(label: string, path: string, disabled = false) {
  return `<button type="button" aria-label="${label}" ${disabled ? "disabled" : ""} style="display:flex;align-items:center;background:none;border:0;color:inherit;padding:4px;cursor:pointer;opacity:${disabled ? ".35" : "1"}"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${path}</svg></button>`;
}

export default function NativeVideoPlayer(
  props: PlayerProps & { onFallback: () => void },
) {
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let player: Artplayer | undefined,
      hls: Hls | undefined,
      recorded = false,
      advanced = false,
      last = 0;
    let autoNext = true;
    try {
      autoNext = localStorage.getItem("apex_player_auto_next") !== "false";
    } catch {}
    setError("");
    setLoading(true);
    const load = async () => {
      try {
        const response = await fetch(props.stream.url, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Source unavailable");
        if (controller.signal.aborted || !host.current) return;
        const captions = (data.subtitles || []).filter(
          (track: { format?: string }) => track.format === "vtt",
        );
        player = new Artplayer({
          container: host.current,
          url: data.url,
          type: "m3u8",
          theme: "#b58aff",
          autoplay: true,
          fullscreen: false,
          fullscreenWeb: false,
          pip: true,
          setting: true,
          playbackRate: true,
          aspectRatio: true,
          subtitle: captions.length
            ? { url: captions[0].url, type: "vtt" }
            : undefined,
          settings: [
            {
              name: "auto-next",
              html: "Auto Next",
              switch: autoNext,
              onSwitch: (item) => {
                autoNext = !item.switch;
                try {
                  localStorage.setItem(
                    "apex_player_auto_next",
                    String(autoNext),
                  );
                } catch {}
                return autoNext;
              },
            },
            ...(captions.length
              ? [
                  {
                    name: "captions",
                    html: "Subtitles",
                    selector: [
                      { html: "Off", url: "" },
                      ...captions.map(
                        (
                          track: { label: string; url: string },
                          index: number,
                        ) => ({
                          html: track.label,
                          url: track.url,
                          default: index === 0,
                        }),
                      ),
                    ],
                    onSelect: (item: {url?: unknown; html: string}) => {
                      if (player) {
                        player.subtitle.show = !!item.url;
                        if (typeof item.url === "string" && item.url)
                          player.subtitle.switch(item.url);
                      }
                      return item.html;
                    },
                  },
                ]
              : []),
          ],
          controls: [
            {
              name: "screen-fullscreen",
              position: "right",
              index: 90,
              html: controlButton(
                "Fullscreen player",
                '<path d="M3 3h6v2H5v4H3zm12 0h6v6h-2V5h-4zM3 15h2v4h4v2H3zm16 0h2v6h-6v-2h4z"/>',
              ),
              tooltip: "Fullscreen",
              click: () => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else
                  void dialog.current
                    ?.requestFullscreen()
                    .catch(() =>
                      setError("Fullscreen is unavailable in this browser."),
                    );
              },
            },
            {
              name: "previous-episode",
              position: "left",
              index: 21,
              html: controlButton(
                "Previous episode",
                '<path d="M5 5h2v14H5zm14 0v14L8 12z"/>',
                props.episode <= 1,
              ),
              tooltip: "Previous episode (B)",
              click: () => {
                if (callbacks.current.episode > 1)
                  callbacks.current.onPrevious();
              },
            },
            {
              name: "next-episode",
              position: "left",
              index: 22,
              html: controlButton(
                "Next episode",
                '<path d="M17 5h2v14h-2zM5 5l11 7-11 7z"/>',
                !props.canNext,
              ),
              tooltip: "Next episode (N)",
              click: () => {
                if (callbacks.current.canNext) callbacks.current.onNext();
              },
            },
          ],
          customType: {
            m3u8: (video: HTMLVideoElement, url: string) => {
              if (Hls.isSupported()) {
                hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.ERROR, (_event, detail) => {
                  if (detail.fatal)
                    setError("This stream failed. Try MegaPlay below.");
                });
              } else if (video.canPlayType("application/vnd.apple.mpegurl"))
                video.src = url;
              else setError("HLS playback is unavailable in this browser.");
            },
          },
        });
        player.on("video:timeupdate", () => {
          if (!player || controller.signal.aborted) return;
          const position = player.currentTime,
            duration = player.duration;
          if (!Number.isFinite(duration) || duration <= 0) return;
          if (Date.now() - last > 5000) {
            callbacks.current.onProgress?.(position, duration);
            last = Date.now();
          }
          if (
            !recorded &&
            callbacks.current.accounts.autoSync &&
            position >= duration * 0.8
          ) {
            recorded = true;
            callbacks.current.onWatched();
          }
        });
        player.on("video:error", () =>
          setError("Video could not load. Try MegaPlay below."),
        );
        player.on("video:ended", () => {
          if (
            !controller.signal.aborted &&
            !advanced &&
            autoNext &&
            callbacks.current.canNext
          ) {
            advanced = true;
            callbacks.current.onNext();
          }
        });
        player.on("ready", () => setLoading(false));
        setLoading(false);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : "Source unavailable",
          );
          setLoading(false);
        }
      }
    };
    void load();
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input,select,textarea,[contenteditable=true]")
      )
        return;
      if (event.key.toLowerCase() === "n" && callbacks.current.canNext) {
        event.preventDefault();
        callbacks.current.onNext();
      }
      if (event.key.toLowerCase() === "b" && callbacks.current.episode > 1) {
        event.preventDefault();
        callbacks.current.onPrevious();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      controller.abort();
      document.removeEventListener("keydown", keyboard);
      hls?.destroy();
      player?.destroy(true);
    };
  }, [props.stream.url]);
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Anime video player"
      className="apex-native-player fixed inset-0 z-[500] bg-black text-white flex flex-col"
    >
      <div className="native-player-header shrink-0 flex gap-4 px-4 py-2 text-sm">
        <span className="flex-1">
          {props.title} · Episode {props.episode} · Apex Player (Sub)
        </span>
        <button onClick={props.onFallback}>Use MegaPlay</button>
        <button onClick={props.onClose} aria-label="Close video player">
          Close
        </button>
      </div>
      {loading && <p role="status">Loading episode source…</p>}
      {error && (
        <p role="alert" className="px-4 text-amber-300">
          {error}
        </p>
      )}
      <div ref={host} className="flex-1 min-h-0" />
    </div>
  );
}
