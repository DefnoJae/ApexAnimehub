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
import { SignSync } from "./SignSync";
import { usePlayerKeyboard } from "../hooks/usePlayerKeyboard";
export default function AniPmPlayer(props: PlayerProps) {
  const host = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    instance = useRef<Player>();
  const callbacks = useRef(props);
  callbacks.current = props;
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [unresponsive, setUnresponsive] = useState(false);
  const recorded = useRef(new Set<number>());
  const pendingCommands = useRef<Array<(player: Player) => unknown>>([]);
  const recovery = useRef<{
    episode: number;
    lang: "sub" | "dub";
    position: number;
  }>();
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
  const clock = useRef(0);
  const [playingEntry, setPlayingEntry] = useState<{
    episode: number;
    lang: "sub" | "dub";
  }>({ episode, lang });
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
  const command = (action: (player: Player) => unknown) => {
    if (startChoice === null) return;
    if (instance.current) return action(instance.current);
    if (pendingCommands.current.length < 10)
      pendingCommands.current.push(action);
  };
  const reloadPlayer = () => {
    const state = instance.current?.state;
    const entry = state && validAniPmState(state, id) ? state : playingEntry;
    const position =
      latest.current?.episode === entry.episode
        ? latest.current.position
        : clock.current;
    recovery.current = {
      episode: entry.episode,
      lang: entry.lang,
      position: Math.max(0, position || 0),
    };
    setUnresponsive(false);
    setError("");
    setReload((value) => value + 1);
  };
  usePlayerKeyboard(dialog, {
    toggle: () =>
      startChoice === null
        ? setStartChoice(savedResume)
        : command((player) => player.togglePlay()),
    seek: (seconds) => command((player) => player.seekBy(seconds)),
    fullscreen: () =>
      document.fullscreenElement
        ? document.exitFullscreen()
        : enterFullscreen(),
    next: () =>
      command((player) =>
        player.state.hasNext === false ? undefined : player.next(),
      ),
    previous: () =>
      command((player) =>
        player.state.hasPrevious === false ? undefined : player.previous(),
      ),
    error: (reason) => {
      if (
        reason &&
        typeof reason === "object" &&
        "code" in reason &&
        reason.code === "destroyed"
      )
        return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Player command failed. Reload the player to reconnect.",
      );
      setUnresponsive(true);
    },
  });
  useEffect(() => {
    if (startChoice === null) return;
    let waitingForStart =
      (recovery.current?.position ?? startChoice) > 0
        ? {
            episode: recovery.current?.episode ?? episode,
            position: recovery.current?.position ?? startChoice,
          }
        : null;
    const report = callbacks.current.onProgress;
    const flush = () => {
      const value = latest.current;
      if (!value) return;
      saveEpisodeProgress(id, value.episode, value.position, value.duration);
      report?.(value.position, value.duration, value.episode);
    };
    let active = true,
      last = 0;
    const watched = recorded.current;
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
          episode: recovery.current?.episode ?? episode,
          lang: recovery.current?.lang ?? lang,
          color: "#b58aff",
          start: recovery.current?.position ?? startChoice,
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
        // SDK methods queue their messages until the embed connects.
        for (const action of pendingCommands.current.splice(0))
          void Promise.resolve(action(player)).catch((reason) => {
            if (active) {
              setError(reason.message);
              setUnresponsive(true);
            }
          });
        const stateChanged = (state: PlayerState) => {
          if (active && validAniPmState(state, id)) {
            if (waitingForStart && waitingForStart.episode !== state.episode)
              waitingForStart = null;
            clock.current = Number.isFinite(state.currentTime)
              ? state.currentTime
              : 0;
            setPlayingEntry((previous) =>
              previous.episode === state.episode && previous.lang === state.lang
                ? previous
                : { episode: state.episode, lang: state.lang },
            );
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
          clock.current = position;
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
          if (active) {
            setUnresponsive(true);
            setError(
              data.message ||
                "Ani.pm playback failed. Try reloading the player.",
            );
          }
        });
      })
      .catch((reason) => {
        if (active) {
          setError(reason.message);
          setUnresponsive(true);
        }
      });
    // A crashed cross-origin frame cannot report a DOM error to its parent.
    // Probe its SDK after fullscreen changes and periodically, without reloading
    // healthy or paused playback. Recovery is an explicit, position-preserving action.
    let checking = false,
      misses = 0;
    const check = async () => {
      const player = instance.current;
      if (
        !active ||
        checking ||
        document.visibilityState === "hidden" ||
        typeof player?.getState !== "function"
      )
        return;
      checking = true;
      try {
        const state = await player.getState();
        if (active && validAniPmState(state, id) && state.status !== "error") {
          misses = 0;
          setUnresponsive(false);
          setError((previous) =>
            previous.startsWith("The video player stopped responding.")
              ? ""
              : previous,
          );
        }
      } catch {
        if (active && ++misses >= 2) {
          setUnresponsive(true);
          setError(
            "The video player stopped responding. Reload it to continue from your saved position.",
          );
        }
      } finally {
        checking = false;
      }
    };
    const probe = window.setInterval(() => void check(), 20000);
    const changed = () => {
      flush();
      void check();
    };
    document.addEventListener("fullscreenchange", changed);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      active = false;
      window.removeEventListener("pagehide", flush);
      instance.current?.destroy();
      instance.current = undefined;
      clearInterval(probe);
      document.removeEventListener("fullscreenchange", changed);
    };
    // Episode/language changes use the SDK without remounting the iframe.
  }, [id, startChoice, reload]);
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
      className="apex-native-player anipm-player fixed inset-0 z-[500] bg-black text-white flex flex-col"
    >
      <div className="native-player-header shrink-0 flex items-center gap-2 px-4 py-2 text-sm">
        <span className="flex-1 min-w-0 truncate">
          {props.title} · Episode {props.episode} · {props.stream.name}
        </span>
        <SignSync
          key={`${id}:${playingEntry.episode}:${playingEntry.lang}`}
          animeId={id}
          episode={playingEntry.episode}
          language={playingEntry.lang}
          root={dialog}
          position={() => clock.current}
        />
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
        <div role="alert" className="anipm-player-error">
          <span>{error}</span>
          {unresponsive && (
            <button onClick={reloadPlayer}>Reload player</button>
          )}
        </div>
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
      <div ref={host} className="anipm-player-stage" />
    </div>
  );
}
