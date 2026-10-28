import React, { useEffect, useRef, useState } from "react";
import { Maximize, X } from "lucide-react";
import type { PlayerProps } from "./VideoPlayer";
import type { Player, PlayerState } from "../utils/anipm-sdk";
import { loadAniPmSdk, validAniPmState } from "../utils/anipm";
import {
  readEpisodeProgress,
  saveEpisodeProgress,
  resumeSeconds,
  playbackTime,
} from "../utils/playbackResume";
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
  const savedResume = resumeSeconds(
    readEpisodeProgress(id, episode) || props.resume,
  );
  const [startChoice, setStartChoice] = useState<number | null>(() =>
    savedResume > 0 ? null : 0,
  );
  const latest = useRef<{
    episode: number;
    position: number;
    duration: number;
  }>();
  useEffect(() => {
    if (startChoice === null) return;
    let waitingForStart =
      startChoice > 0 ? { episode, position: startChoice } : null;
    const report = callbacks.current.onProgress;
    const flush = () => {
      const value = latest.current;
      if (!value) return;
      saveEpisodeProgress(id, value.episode, value.position, value.duration);
      report?.(value.position, value.duration, value.episode);
    };
    let active = true,
      last = 0;
    const watched = new Set<number>();
    setError("");
    void loadAniPmSdk()
      .then(() => {
        if (!active || !host.current) return;
        // Configure permissions while detached: changing allow after navigation
        // does not revoke the policy already inherited by nested documents.
        const mount = document.createElement("div");
        mount.style.height = "100%";
        const player = new window.AniPM.Player(mount, {
          anime: id,
          episode,
          lang,
          color: "#b58aff",
          start: startChoice,
          autoplay: true,
          episodes: true,
          reportPage: false,
          theaterLayout: false,
          height: "100%",
          title: `${callbacks.current.title} anime player`,
        });
        instance.current = player;
        // Deny fullscreen to the provider and all nested frames. The parent dialog
        // remains eligible for fullscreen through ApexAnimehub's own control.
        player.iframe.removeAttribute("allowfullscreen");
        player.iframe.allow = player.iframe.allow
          .split(";")
          .filter((permission) => !permission.trim().startsWith("fullscreen"))
          .concat("fullscreen 'none'")
          .join(";");
        host.current.replaceChildren(mount);
        const stateChanged = (state: PlayerState) => {
          if (active && validAniPmState(state, id)) {
            if (waitingForStart && waitingForStart.episode !== state.episode)
              waitingForStart = null;
            callbacks.current.onEpisodeChange?.(state.episode, state.lang);
          }
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
          if (waitingForStart && waitingForStart.episode === state.episode) {
            if (position + 2 < waitingForStart.position) return;
            waitingForStart = null;
          }
          latest.current = { episode: state.episode, position, duration };
          if (Date.now() - last >= 5000) {
            last = Date.now();
            saveEpisodeProgress(id, state.episode, position, duration);
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
        player.on("pause", flush);
        player.on("ended", flush);
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
    window.addEventListener("pagehide", flush);
    document.addEventListener("keydown", keyboard);
    return () => {
      flush();
      active = false;
      window.removeEventListener("pagehide", flush);
      instance.current?.destroy();
      instance.current = undefined;
      document.removeEventListener("keydown", keyboard);
    };
    // Episode/language changes use the SDK without remounting the iframe.
  }, [id, startChoice]);
  useEffect(() => {
    const player = instance.current;
    if (
      player &&
      (player.state.episode !== episode || player.state.lang !== lang)
    )
      void player
        .loadEpisode(episode, {
          lang,
          start: resumeSeconds(
            readEpisodeProgress(id, episode) || callbacks.current.resume,
          ),
        })
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
      <div className="native-player-header shrink-0 flex items-center gap-2 px-4 py-2 text-sm">
        <span className="flex-1 min-w-0 truncate">
          {props.title} · Episode {props.episode} · {props.stream.name}
        </span>
        <button
          className="player-header-icon"
          onClick={enterFullscreen}
          aria-label="Fullscreen video"
          title="Fullscreen (F)"
        >
          <Maximize size={18} aria-hidden="true" />
        </button>
        <button
          className="player-header-icon"
          onClick={props.onClose}
          aria-label="Close video player"
          title="Close player"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p role="alert" className="px-4 text-amber-300">
          {error}
        </p>
      )}
      {startChoice === null && (
        <div
          className="anipm-resume-prompt"
          role="group"
          aria-label="Continue watching"
        >
          <h2>Continue watching?</h2>
          <p>
            {props.title} · Episode {episode}
          </p>
          <div>
            <button onClick={() => setStartChoice(savedResume)}>
              Continue from {playbackTime(savedResume)}
            </button>
            <button
              onClick={() => {
                saveEpisodeProgress(
                  id,
                  episode,
                  0,
                  props.resume?.duration ||
                    readEpisodeProgress(id, episode)?.duration ||
                    1,
                );
                setStartChoice(0);
              }}
            >
              Start from the beginning
            </button>
          </div>
        </div>
      )}
      <div ref={host} className="flex-1 min-h-0" />
    </div>
  );
}
