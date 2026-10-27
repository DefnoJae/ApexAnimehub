import React, { useEffect, useRef, useState } from "react";
import type { PlayerProps } from "./VideoPlayer";
import type { Player, PlayerState } from "../utils/anipm-sdk";
import { loadAniPmSdk, validAniPmState } from "../utils/anipm";
import "./nativeVideoPlayer.css";
export default function AniPmPlayer(props: PlayerProps) {
  const host = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    instance = useRef<Player>();
  const callbacks = useRef(props);
  callbacks.current = props;
  const [error, setError] = useState("");
  const enterFullscreen = async () => {
    try {
      const element = dialog.current;
      if (!element) return;
      // Fullscreen our stable host instead of moving the provider's nested video frame.
      // Keep the SDK instance alive across the resulting resize/fullscreen events.
      if (!element.requestFullscreen) throw new Error("Fullscreen unavailable");
      await element.requestFullscreen();
      element.focus({ preventScroll: true });
      setError("");
    } catch {
      setError(
        "Fullscreen could not open in this browser. Playback can continue here; try opening the site in Edge, Chrome, or Safari.",
      );
    }
  };
  const path = new URL(props.stream.url).pathname.split("/");
  const id = Number(path[3]),
    episode = Number(path[4]),
    lang = path[5] === "dub" ? "dub" : "sub";
  useEffect(() => {
    let active = true,
      last = 0;
    const watched = new Set<number>();
    setError("");
    void loadAniPmSdk()
      .then(() => {
        if (!active || !host.current) return;
        const player = new window.AniPM.Player(host.current, {
          anime: id,
          episode,
          lang,
          color: "#b58aff",
          autoplay: true,
          episodes: true,
          reportPage: false,
          theaterLayout: false,
          height: "100%",
          title: `${callbacks.current.title} anime player`,
        });
        instance.current = player;
        const stateChanged = (state: PlayerState) => {
          if (active && validAniPmState(state, id))
            callbacks.current.onEpisodeChange?.(state.episode, state.lang);
        };
        player.on("ready", stateChanged);
        player.on("episodechange", stateChanged);
        player.on("languagechange", stateChanged);
        player.on("timeupdate", (data) => {
          const state = player.state;
          if (!active || !validAniPmState(state, id)) return;
          const position = data.currentTime,
            duration = data.duration;
          if (
            !Number.isFinite(position) ||
            !Number.isFinite(duration) ||
            duration <= 0 ||
            position < 0 ||
            position > duration + 5
          )
            return;
          if (Date.now() - last >= 5000) {
            last = Date.now();
            callbacks.current.onProgress?.(position, duration, state.episode);
          }
          if (
            !watched.has(state.episode) &&
            callbacks.current.accounts.autoSync &&
            position >= duration * 0.8
          ) {
            watched.add(state.episode);
            callbacks.current.onWatched(state.episode);
          }
        });
        player.on("error", (data) => {
          if (active)
            setError(
              data.message || "Ani.pm playback failed. Try another source.",
            );
        });
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      });
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input,select,textarea,[contenteditable=true]")
      )
        return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat)
        return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (document.fullscreenElement)
          void document
            .exitFullscreen()
            .catch(() => setError("Press Esc to leave fullscreen."));
        else void enterFullscreen();
        return;
      }
      const player = instance.current;
      if (event.key.toLowerCase() === "n" && player) {
        event.preventDefault();
        void player.next().catch((e) => setError(e.message));
      }
      if (event.key.toLowerCase() === "b" && player) {
        event.preventDefault();
        void player.previous().catch((e) => setError(e.message));
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      active = false;
      instance.current?.destroy();
      instance.current = undefined;
      document.removeEventListener("keydown", keyboard);
    };
    // Episode/language changes use the SDK without remounting the iframe.
  }, [id]);
  useEffect(() => {
    const player = instance.current;
    if (
      player &&
      (player.state.episode !== episode || player.state.lang !== lang)
    )
      void player
        .loadEpisode(episode, { lang })
        .catch((e) => setError(e.message));
  }, [episode, lang]);
  return (
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Anime video player"
      className="apex-native-player fixed inset-0 z-[500] bg-black text-white flex flex-col"
    >
      <div className="native-player-header shrink-0 flex gap-4 px-4 py-2 text-sm">
        <span className="flex-1">
          {props.title} · Episode {props.episode} · {props.stream.name}
        </span>
        <button onClick={enterFullscreen} aria-label="Fullscreen video">
          Fullscreen
        </button>
        <button onClick={props.onClose} aria-label="Close video player">
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className="px-4 text-amber-300">
          {error}
        </p>
      )}
      <div ref={host} className="flex-1 min-h-0" />
    </div>
  );
}
