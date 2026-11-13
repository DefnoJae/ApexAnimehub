import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  ArrowLeft,
  AudioLines,
  Layers,
  ListVideo,
  Maximize,
  MessageSquare,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { PlayerProps } from "./VideoPlayer";
import { usePlayerKeyboard } from "../hooks/usePlayerKeyboard";
import { fetchHeroArtwork } from "../utils/heroArtwork";
import {
  fetchEpisodeMetadata,
  type EpisodeMetadata,
} from "../utils/episodeMetadata";
import {
  playbackTime,
  readEpisodeProgress,
  resumeSeconds,
  saveEpisodeProgress,
} from "../utils/playbackResume";
import { HeroBackdrop } from "./HeroBackdrop";
import { StyledSigns } from "./StyledSigns";
import { PlayerEpisodeCarousel } from "./PlayerEpisodeCarousel";
import { StyledSelect } from "./StyledSelect";
import { SignSync } from "./SignSync";
import "./nativeVideoPlayer.css";
import "./apexPlayer.css";

type Track = { url: string; label: string; language?: string; format: string };
type Chapter = { kind: "intro" | "outro"; start: number; end: number };
type MediaSource = {
  chapters?: Chapter[];
  url: string;
  subtitles: Track[];
  provider: string;
  quality: string;
};
type Menu = "episodes" | "captions" | "audio" | "sources" | "settings";
type CaptionMode = "signs" | "full" | "off";

function read(key: string) {
  try {
    return localStorage.getItem("apex_native_" + key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem("apex_native_" + key, value);
  } catch {}
}
function trackKind(track: Track) {
  if (/signs|songs|forced/i.test(track.label)) return "signs";
  if (/\bcc\b|closed captions|dubtitle/i.test(track.label)) return "cc";
  return "full";
}

export default function NativeVideoPlayer(props: PlayerProps) {
  const fullscreenHost = useRef<HTMLDivElement>(null);
  return (
    <div className="apex-player-fullscreen-host" ref={fullscreenHost}>
      <EpisodePlayer key={props.stream.url} {...props} fullscreenHost={fullscreenHost} />
    </div>
  );
}

function EpisodePlayer(props: PlayerProps & {
  fullscreenHost: React.RefObject<HTMLDivElement>;
}) {
  const url = new URL(props.stream.url, window.location.origin);
  const id = Number(url.searchParams.get("id"));
  const { episode } = props;
  const audio = props.audio || "sub";
  const dialog = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls>();
  const callbacks = useRef(props);
  callbacks.current = props;
  const [source, setSource] = useState<MediaSource>();
  const [error, setError] = useState("");
  const [menu, setMenu] = useState<Menu>();
  const [paused, setPaused] = useState(true);
  const [hasVideoFrame, setHasVideoFrame] = useState(false);
  const [pauseOverlay, setPauseOverlay] = useState(false);
  const [loadedCaption, setLoadedCaption] = useState<{ track: string; url: string }>();
  const [captionError, setCaptionError] = useState("");
  const captionElement = useRef<HTMLTrackElement>(null);
  const [controls, setControls] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [muted, setMuted] = useState(false);
  const [logo, setLogo] = useState("");
  const [episodes, setEpisodes] = useState<Record<string, EpisodeMetadata>>({});
  const [track, setTrack] = useState("");
  const [ass, setAss] = useState("");
  const [captionColor, setCaptionColor] = useState("#ffffff");
  const [captionOutline, setCaptionOutline] = useState(true);
  const [volume, setVolume] = useState(1);
  const [captionMode, setCaptionMode] = useState<CaptionMode>(() =>
    read("dub_captions") === "full"
      ? "full"
      : read("dub_captions") === "off"
        ? "off"
        : "signs",
  );
  const [autoNext, setAutoNext] = useState(() => read("auto_next") === "true");
  const [jump, setJump] = useState(() => Number(read("jump")) || 10);
  const [side, setSide] = useState(() => read("episode_panel") === "side");
  const [fit, setFit] = useState<"contain" | "cover" | "fill">("contain");
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState(-1);
  const [levels, setLevels] = useState<number[]>([]);
  const [captionSize, setCaptionSize] = useState(40);
  const [captionBackground, setCaptionBackground] = useState(false);
  const [filter, setFilter] = useState("none");
  const [scrub, setScrub] = useState<number>();
  const [saved] = useState(() =>
    resumeSeconds(readEpisodeProgress(id, episode) || props.resume),
  );
  const [start, setStart] = useState<number | null>(saved ? null : 0);
  const hideTimer = useRef<number>();
  const watched = useRef(false);
  const lastSaved = useRef(0);
  const selectedTrack = useRef("");
  const currentEpisode = episodes[episode];
  const noFonts = useRef<string[]>([]);
  const eligibleTracks = source?.subtitles || [];
  const chapters = source?.chapters || [];
  const activeChapter = hasVideoFrame && chapters.find((chapter) =>
    position >= chapter.start && position < chapter.end &&
    chapter.start < duration && chapter.end <= duration + 1,
  );

  const persist = (force = false) => {
    const media = video.current;
    if (!media || !Number.isFinite(media.duration) || media.duration <= 0)
      return;
    if (!force && Date.now() - lastSaved.current < 5000) return;
    lastSaved.current = Date.now();
    saveEpisodeProgress(id, episode, media.currentTime, media.duration);
    callbacks.current.onProgress?.(media.currentTime, media.duration, episode);
  };

  useEffect(() => {
    let active = true;
    void fetchHeroArtwork(id).then((items) => {
      if (active) setLogo(items[0] || "");
    });
    void fetchEpisodeMetadata(id, props.episodeCount).then((items) => {
      if (active) setEpisodes(items);
    });
    return () => {
      active = false;
    };
  }, [id, props.episodeCount]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 28000);
    const fail = (message: string) => {
      setError(message);
      callbacks.current.onPlaybackSource?.("anipm", audio);
    };
    void fetch(props.stream.url, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (
          !response.ok ||
          typeof data.url !== "string" ||
          data.audio !== audio
        )
          throw new Error(data.error || "No compatible stream is available.");
        if (!controller.signal.aborted)
          setSource({
            ...data,
            subtitles: Array.isArray(data.subtitles)
              ? data.subtitles.filter(
                  (item: Track) =>
                    ["vtt", "ass", "srt"].includes(item.format),
                )
              : [],
          });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          fail(
            reason instanceof Error ? reason.message : "Playback unavailable.",
          );
        else if (!disposed) fail("The source took too long to respond.");
      })
      .finally(() => window.clearTimeout(timeout));
    let disposed = false;
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [props.stream.url, audio]);

  useEffect(() => {
    if (!source || start === null || !video.current) return;
    const media = video.current;
    let engine: Hls | undefined;
    let failed = false;
    let started = false;
    const fallback = () => {
      if (failed) return;
      failed = true;
      if (started && Number.isFinite(media.duration) && media.duration > 0) {
        saveEpisodeProgress(id, episode, media.currentTime, media.duration);
        callbacks.current.onProgress?.(
          media.currentTime,
          media.duration,
          episode,
        );
      }
      setError("The stream stopped. Opening Ani.pm…");
      callbacks.current.onPlaybackSource?.("anipm", audio);
    };
    const load = () => {
      if (start > 0 && start < media.duration) media.currentTime = start;
      started = true;
      void media.play().catch(() => {});
    };
    const startup = window.setTimeout(fallback, 22000);
    const clearStartup = () => window.clearTimeout(startup);
    media.addEventListener("loadedmetadata", load, { once: true });
    media.addEventListener("canplay", clearStartup, { once: true });
    media.addEventListener("error", fallback);
    if (Hls.isSupported()) {
      engine = new Hls({ startPosition: start });
      hls.current = engine;
      engine.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!engine) return;
        const heights = engine.levels.map((level) => level.height);
        setLevels(heights);
        const preferred = heights.lastIndexOf(1080);
        const best =
          preferred >= 0 ? preferred : heights.indexOf(Math.max(...heights));
        if (best >= 0) {
          engine.startLevel = best;
          engine.autoLevelCapping = best;
        }
      });
      engine.on(Hls.Events.ERROR, (_event, detail) => {
        if (detail.fatal) fallback();
      });
      engine.attachMedia(media);
      engine.loadSource(source.url);
    } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
      media.src = source.url;
    } else fallback();
    return () => {
      clearStartup();
      media.removeEventListener("loadedmetadata", load);
      media.removeEventListener("canplay", clearStartup);
      media.removeEventListener("error", fallback);
      engine?.destroy();
      hls.current = undefined;
    };
  }, [source, start, id, episode, audio]);

  useEffect(() => {
    if (!source) return;
    const english = source.subtitles.filter(
      (item) =>
        /^(en|eng)(-|$)|english/i.test(item.language || item.label) ||
        /english/i.test(item.label),
    );
    const preference = audio === "sub" ? "full" : captionMode;
    const match =
      preference === "full"
        ? english.find((item) => trackKind(item) === "cc" && !/dubtitle|\bAI\b/i.test(item.label)) ||
          english.find((item) => trackKind(item) === "full") ||
          english.find((item) => trackKind(item) === "cc")
        : preference === "signs"
          ? english.find((item) => trackKind(item) === "signs" && item.format === "ass") ||
            english.find((item) => trackKind(item) === "full") ||
            english.find((item) => trackKind(item) === "signs") ||
            english.find((item) => trackKind(item) === "cc")
          : undefined;
    setTrack(match?.url || "");
  }, [source, audio, captionMode]);

  useEffect(() => {
    setAss("");
    setLoadedCaption(undefined);
    setCaptionError("");
    const selected = source?.subtitles.find((item) => item.url === track);
    if (!selected) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetch(selected.url, { signal: controller.signal, credentials: "omit" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Subtitle unavailable");
        let text = (await response.text()).replace(/^\uFEFF/, "").trimStart();
        if (text.length > 4_000_000) throw new Error("Subtitle is too large");
        if (controller.signal.aborted) return;
        if (selected.format === "srt") {
          text = "WEBVTT\n\n" + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
        }
        if (selected.format === "ass" && text.includes("[Script Info]")) {
          setAss(text);
        } else if (["vtt", "srt"].includes(selected.format) && /^WEBVTT(?:\s|$)/.test(text)) {
          objectUrl = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
          setLoadedCaption({ track: selected.url, url: objectUrl });
        } else throw new Error("Invalid subtitle track");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCaptionError("This subtitle track could not load. Try another track.");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [track, source]);

  useEffect(() => {
    const current = captionElement.current?.track;
    if (current) current.mode = pauseOverlay ? "hidden" : "showing";
  }, [loadedCaption, pauseOverlay]);

  useEffect(() => {
    if (!paused || start === null || !duration) {
      setPauseOverlay(false);
      return;
    }
    const timer = window.setTimeout(() => setPauseOverlay(true), 550);
    return () => window.clearTimeout(timer);
  }, [paused, start, duration]);

  useEffect(() => {
    if (paused || menu) {
      setControls(true);
      return;
    }
    hideTimer.current = window.setTimeout(() => setControls(false), 3000);
    return () => window.clearTimeout(hideTimer.current);
  }, [paused, menu]);

  const reveal = () => {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    if (!paused && !menu)
      hideTimer.current = window.setTimeout(() => setControls(false), 3000);
  };
  const toggle = () => {
    if (start === null) return;
    const media = video.current;
    if (media?.paused) void media.play().catch(() => {});
    else media?.pause();
  };
  const seek = (seconds: number) => {
    if (video.current && duration > 0)
      video.current.currentTime = Math.max(0, Math.min(duration, seconds));
  };
  const fullscreen = () =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : props.fullscreenHost.current?.requestFullscreen();
  const chooseEpisode = (number: number) => {
    persist(true);
    setMenu(undefined);
    callbacks.current.onEpisodeChange?.(number, audio);
  };
  const switchAudio = (language: "sub" | "dub") => {
    persist(true);
    props.onPlaybackSource?.("apex", language);
  };
  const toggleCaptions = () => {
    if (track) {
      selectedTrack.current = track;
      setTrack("");
    } else if (selectedTrack.current) setTrack(selectedTrack.current);
    else setMenu("captions");
  };
  usePlayerKeyboard(dialog, {
    toggle,
    seek: (seconds) =>
      seek((video.current?.currentTime || 0) + Math.sign(seconds) * jump),
    fullscreen,
    captions: toggleCaptions,
    next: () => {
      if (props.canNext) chooseEpisode(episode + 1);
    },
    previous: () => {
      if (episode > 1) chooseEpisode(episode - 1);
    },
    error: () => setError("This playback action is unavailable."),
  });
  const showMenu = (name: Menu) =>
    setMenu((current) => (current === name ? undefined : name));
  const icon = (
    label: string,
    content: React.ReactNode,
    action: () => void,
    disabled = false,
    active = false,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={action}
      disabled={disabled}
      className={active ? "is-active" : ""}
    >
      {content}
    </button>
  );
  const episodeNumbers = Array.from(
    {
      length: Math.min(
        props.episodeCount ||
          Math.max(episode, ...Object.keys(episodes).map(Number)),
        2000,
      ),
    },
    (_, i) => i + 1,
  );

  return (
    <div
      ref={dialog}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Apex Player"
      className={`apex-native-player apex-cinema${pauseOverlay ? " has-pause-overlay" : ""}`}
      onPointerMove={reveal}
      onKeyDown={(event) => {
        if (menu && (event.key === "Escape" || (menu === "episodes" && event.key.toLowerCase() === "x" && !event.ctrlKey && !event.metaKey && !event.altKey))) {
          event.preventDefault();
          event.stopPropagation();
          setMenu(undefined);
        }
      }}
      style={
        {
          "--apex-caption-size": captionSize + "px",
          "--apex-caption-bg": captionBackground ? "#000c" : "transparent",
          "--apex-caption-color": captionColor,
          "--apex-caption-outline": captionOutline
            ? "3px 0 #000, -3px 0 #000, 0 3px #000, 0 -3px #000, 2px 2px #000, -2px -2px #000, 2px -2px #000, -2px 2px #000"
            : "none",
        } as React.CSSProperties
      }
    >
      <video
        ref={video}
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        style={{ objectFit: fit, filter }}
        muted={muted}
        onClick={(event) => {
          if (window.matchMedia("(pointer: coarse)").matches) reveal();
          else toggle();
        }}
        onDoubleClick={(event) => {
          if (!window.matchMedia("(pointer: coarse)").matches) return;
          seek(
            position + (event.clientX < window.innerWidth / 2 ? -jump : jump),
          );
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => setPaused(false)}
        onPlaying={() => setHasVideoFrame(true)}
        onPause={() => {
          setPaused(true);
          persist(true);
        }}
        onTimeUpdate={(event) => {
          const media = event.currentTarget;
          setPosition(media.currentTime);
          persist();
          if (
            !watched.current &&
            props.accounts.autoSync &&
            Number.isFinite(media.duration) &&
            media.duration > 0 &&
            media.currentTime >= media.duration * 0.8
          ) {
            watched.current = true;
            props.onWatched(episode);
          }
        }}
        onEnded={() => {
          persist(true);
          if (autoNext && props.canNext) chooseEpisode(episode + 1);
        }}
      >
        {loadedCaption && loadedCaption.track === track && (
          <track
            key={loadedCaption.url}
            ref={captionElement}
            src={loadedCaption.url}
            kind="subtitles"
            label={eligibleTracks.find((item) => item.url === track)?.label}
            onLoad={(event) => {
              const textTrack = event.currentTarget.track;
              // Keep explicitly positioned cues where their authors placed them.
              for (const cue of Array.from(textTrack.cues || [])) {
                if (typeof VTTCue !== "undefined" && cue instanceof VTTCue && cue.line === "auto") {
                  cue.snapToLines = false;
                  cue.line = 94;
                  cue.lineAlign = "end";
                }
              }
              textTrack.mode = pauseOverlay ? "hidden" : "showing";
            }}
            onError={() => setCaptionError("This subtitle track could not render. Try another track.")}
          />
        )}
      </video>
      {!hasVideoFrame && props.anime && (
        <div className="apex-player-loading-art"><HeroBackdrop anime={props.anime} /></div>
      )}
      {ass && (
        <StyledSigns
          ass={ass}
          fonts={noFonts.current}
          root={dialog}
          position={() => video.current?.currentTime || 0}
          delay={0}
          onFailure={() => {
            setAss("");
            setCaptionError("Styled subtitles could not render. Try another track.");
          }}
        />
      )}

      <header className="apex-player-top" hidden={!controls && start !== null}>
        {icon("Back to anime details", <ArrowLeft />, () => {
          persist(true);
          props.onClose();
        })}
        <span>
          {props.title} · Episode {episode}
          {currentEpisode?.title ? " · " + currentEpisode.title : ""}
        </span>
        <div className="apex-player-signsync">
          <SignSync
            key={id + ":" + episode}
            animeId={id}
            episode={episode}
            language={audio}
            root={dialog}
            position={() => video.current?.currentTime || 0}
          />
        </div>
      </header>
      {error || (captionError && menu !== "captions") ? (
        <p role="alert" className="apex-player-status">
          {error || captionError}
        </p>
      ) : null}
      {!hasVideoFrame && start !== null && !error && (
        <div className="apex-player-loading" role="status">
          {logo ? <img src={logo} alt={props.title} /> : <strong>{props.title}</strong>}
          <span>Episode {episode} · {audio === "dub" ? "Dub" : "Sub"}</span>
          <span className="apex-player-loading-line" aria-hidden="true" />
          <small>{source ? "Starting playback…" : "Finding a stream…"}</small>
        </div>
      )}
      {start === null && (
        <div className="anipm-resume-prompt">
          <h2>Continue watching?</h2>
          <p>
            {props.title} · Episode {episode}
          </p>
          <div>
            <button onClick={() => setStart(saved)}>
              Continue from {playbackTime(saved)}
            </button>
            <button onClick={() => setStart(0)}>
              Start from the beginning
            </button>
          </div>
        </div>
      )}
      {pauseOverlay && (
        <div className="apex-player-pause">
          <div>
            {logo ? (
              <img src={logo} alt={props.title} onError={() => setLogo("")} />
            ) : (
              <h2>{props.title}</h2>
            )}
            <strong>
              Episode {episode}
              {currentEpisode?.title ? " · " + currentEpisode.title : ""}
            </strong>
            {currentEpisode?.overview && <p>{currentEpisode.overview}</p>}
            <small>{playbackTime(Math.max(0, duration - position))} left</small>
          </div>
        </div>
      )}
      {menu === "episodes" && !side && (
        <PlayerEpisodeCarousel episode={episode} numbers={episodeNumbers} episodes={episodes} onSelect={chooseEpisode} onClose={() => { setMenu(undefined); dialog.current?.focus({ preventScroll: true }); }} />
      )}
      {menu === "episodes" && side && (
        <section
          className={"apex-player-episodes" + (side ? " is-side" : "")}
          aria-label="Episodes"
        >
          <header>
            <h2>Episodes</h2>
            <button type="button" className="apex-player-close" aria-label="Close panel" onClick={() => setMenu(undefined)}><X size={17} /></button>
          </header>
          <div
            className="apex-episode-strip"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              )
                return;
              const target = event.target as HTMLElement;
              const next = ["ArrowRight", "ArrowDown"].includes(event.key)
                ? target.nextElementSibling
                : target.previousElementSibling;
              if (next instanceof HTMLElement) {
                event.preventDefault();
                next.focus();
                next.scrollIntoView({ block: "nearest", inline: "nearest" });
              }
            }}
          >
            {episodeNumbers.map((number) => (
              <button
                key={number}
                type="button"
                autoFocus={number === episode}
                aria-current={number === episode ? "true" : undefined}
                onClick={() => chooseEpisode(number)}
              >
                {episodes[number]?.image && (
                  <img src={episodes[number].image} alt="" loading="lazy" />
                )}
                <span>
                  Ep {number} · {episodes[number]?.title || "Episode " + number}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {menu && menu !== "episodes" && (
        <section className="apex-player-menu" aria-label={menu}>
          <header>
            <h2>
              {menu === "captions"
                ? "Subtitles"
                : menu === "sources"
                  ? "Sources"
                  : menu === "audio"
                    ? "Audio"
                    : "Settings"}
            </h2>
            <button type="button" className="apex-player-close" aria-label="Close panel" onClick={() => setMenu(undefined)}><X size={17} /></button>
          </header>
          {menu === "captions" && (
            <>
              {captionError && <p role="alert">{captionError}</p>}
              <button aria-pressed={!track} onClick={() => setTrack("")}>
                Off
              </button>
              {(["signs", "cc", "full", "other"] as const).map((kind) => {
                const tracks = eligibleTracks.filter((item) => {
                  const english = /^(en|eng)(-|$)|english/i.test(item.language || item.label) || /english/i.test(item.label);
                  return kind === "other" ? !english : english && trackKind(item) === kind;
                });
                if (!tracks.length) return null;
                const heading = { signs: "English Signs & Songs", cc: "English closed captions", full: "English full subtitles", other: "Other languages" }[kind];
                const buttons = tracks.map((item) => (
                  <button key={item.url} type="button" aria-pressed={track === item.url} onClick={() => setTrack(item.url)}>
                    {item.label}
                  </button>
                ));
                return kind === "other" ? (
                  <details key={kind} className="apex-caption-group"><summary>{heading}</summary>{buttons}</details>
                ) : (
                  <div key={kind}><strong>{heading}</strong>{buttons}</div>
                );
              })}
              <label>
                On English dub
                <StyledSelect
                  aria-label="On English dub"
                  value={captionMode}
                  onChange={(event) => {
                    const mode = event.target.value as CaptionMode;
                    setCaptionMode(mode);
                    remember("dub_captions", mode);
                  }}
                >
                  <option value="signs">Prefer Signs & Songs</option>
                  <option value="full">Prefer full English CC</option>
                  <option value="off">Off</option>
                </StyledSelect>
              </label>
              <label>
                Dialogue size
                <input
                  type="range"
                  min="14"
                  max="56"
                  value={captionSize}
                  onChange={(e) => setCaptionSize(Number(e.target.value))}
                />
              </label>
              <label>
                Dialogue color
                <input
                  type="color"
                  value={captionColor}
                  onChange={(e) => setCaptionColor(e.target.value)}
                />
              </label>
              <label>
                Dialogue outline
                <input
                  type="checkbox"
                  checked={captionOutline}
                  onChange={(e) => setCaptionOutline(e.target.checked)}
                />
              </label>
              <label>
                Dialogue background
                <input
                  type="checkbox"
                  checked={captionBackground}
                  onChange={(e) => setCaptionBackground(e.target.checked)}
                />
              </label>
            </>
          )}
          {menu === "audio" && (
            <>
              <button
                aria-pressed={audio === "sub"}
                onClick={() => switchAudio("sub")}
              >
                Japanese · English subtitles
              </button>
              <button
                aria-pressed={audio === "dub"}
                onClick={() => switchAudio("dub")}
              >
                English dub
              </button>
              <label>
                Volume
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={volume}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setVolume(value);
                    if (video.current) video.current.volume = value;
                  }}
                />
              </label>
            </>
          )}
          {menu === "sources" && (
            <>
              <button aria-pressed="true" onClick={() => setMenu(undefined)}>
                {source?.provider || "Auto"} ·{" "}
                {source?.quality === "auto"
                  ? "Auto quality"
                  : source?.quality || "Checking"}
                <small>
                  {audio === "sub" ? "Japanese" : "English"} ·{" "}
                  {eligibleTracks.length} subtitle tracks
                </small>
              </button>
              <button
                onClick={() => {
                  persist(true);
                  props.onPlaybackSource?.("anipm", audio);
                }}
              >
                Ani.pm
              </button>
              <button
                onClick={() => {
                  persist(true);
                  props.onPlaybackSource?.("megaplay", audio);
                }}
              >
                MegaPlay
              </button>
            </>
          )}
          {menu === "settings" && (
            <>
              <label>
                Quality
                <StyledSelect
                  aria-label="Quality"
                  value={quality}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setQuality(value);
                    if (hls.current) hls.current.currentLevel = value;
                  }}
                >
                  <option value={-1}>Auto · prefer 1080p</option>
                  {levels.map((height, index) => (
                    <option key={index} value={index}>
                      {height}p
                    </option>
                  ))}
                </StyledSelect>
              </label>
              <label>
                Speed
                <StyledSelect
                  aria-label="Speed"
                  value={speed}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSpeed(value);
                    if (video.current) video.current.playbackRate = value;
                  }}
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}×
                    </option>
                  ))}
                </StyledSelect>
              </label>
              <label>
                Video fit
                <StyledSelect
                  aria-label="Video fit"
                  value={fit}
                  onChange={(e) => setFit(e.target.value as typeof fit)}
                >
                  <option value="contain">Contain</option>
                  <option value="cover">Cover</option>
                  <option value="fill">Fill</option>
                </StyledSelect>
              </label>
              <label>
                Skip interval
                <StyledSelect
                  aria-label="Skip interval"
                  value={jump}
                  onChange={(e) => {
                    setJump(Number(e.target.value));
                    remember("jump", e.target.value);
                  }}
                >
                  {[5, 10, 15, 30].map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </StyledSelect>
              </label>
              <label>
                Episode panel
                <StyledSelect
                  aria-label="Episode panel"
                  value={side ? "side" : "bottom"}
                  onChange={(e) => {
                    setSide(e.target.value === "side");
                    remember("episode_panel", e.target.value);
                  }}
                >
                  <option value="bottom">Bottom</option>
                  <option value="side">Right</option>
                </StyledSelect>
              </label>
              <label>
                Video filter
                <StyledSelect
                  aria-label="Video filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="none">Off</option>
                  <option value="brightness(1.15)">Brighter</option>
                  <option value="contrast(1.12)">More contrast</option>
                </StyledSelect>
              </label>
              <label>
                Auto next
                <input
                  type="checkbox"
                  checked={autoNext}
                  onChange={(e) => {
                    setAutoNext(e.target.checked);
                    remember("auto_next", String(e.target.checked));
                  }}
                />
              </label>
            </>
          )}
        </section>
      )}
      {activeChapter && menu !== "episodes" && (
        <button className="apex-player-skip" type="button" onClick={() => seek(activeChapter.end)}>
          {activeChapter.kind === "intro" ? "Skip intro" : "Skip ending"}
        </button>
      )}
      {start !== null && (
        <footer className="apex-player-bottom" hidden={!controls || menu === "episodes"}>
          <div className="apex-player-timeline" style={{ "--played": (position / (duration || 1)) * 100 + "%" } as React.CSSProperties}>
            <div className="apex-timeline-glass" aria-hidden="true">
              {chapters.filter((chapter) => chapter.start < duration && chapter.end <= duration + 1).map((chapter) => (
                <i key={chapter.kind} style={{ left: chapter.start / duration * 100 + "%", width: (Math.min(duration, chapter.end) - chapter.start) / duration * 100 + "%" }} />
              ))}
            </div>
            {scrub !== undefined && (
              <output
                style={{
                  left: `${Math.max(8, Math.min(92, (scrub / (duration || 1)) * 100))}%`,
                }}
              >
                {playbackTime(scrub)}
              </output>
            )}
            <input
              aria-label="Playback position"
              type="range"
              min="0"
              max={duration || 0}
              step=".1"
              value={position}
              onChange={(e) => seek(Number(e.target.value))}
              onPointerMove={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                setScrub(
                  Math.max(
                    0,
                    Math.min(
                      duration,
                      ((e.clientX - box.left) / box.width) * duration,
                    ),
                  ),
                );
              }}
              onPointerLeave={() => setScrub(undefined)}
            />
          </div>
          <div className="apex-player-tray">
            <div>
              {icon(
                paused ? "Play" : "Pause",
                paused ? <Play /> : <Pause />,
                toggle,
              )}
              <span className="apex-player-pill">
                {icon("Back " + jump + " seconds", <RotateCcw />, () =>
                  seek(position - jump),
                )}
                {icon("Forward " + jump + " seconds", <RotateCw />, () =>
                  seek(position + jump),
                )}
              </span>
              {icon(
                muted ? "Unmute" : "Mute",
                muted ? <VolumeX /> : <Volume2 />,
                () => setMuted(!muted),
              )}
              {icon(
                "Previous episode (B)",
                <SkipBack />,
                () => chooseEpisode(episode - 1),
                episode <= 1,
              )}
              {icon(
                "Next episode (N)",
                <SkipForward />,
                () => chooseEpisode(episode + 1),
                !props.canNext,
              )}
              <span className="apex-player-time">
                {playbackTime(position)} / {playbackTime(duration)}
              </span>
            </div>
            <div>
              {icon(
                "Episodes",
                <ListVideo />,
                () => showMenu("episodes"),
                false,
                menu === "episodes",
              )}
              {icon(
                "Subtitles (C)",
                <MessageSquare />,
                () => showMenu("captions"),
                false,
                menu === "captions",
              )}
              {icon(
                "Audio",
                <AudioLines />,
                () => showMenu("audio"),
                false,
                menu === "audio",
              )}
              {icon(
                "Sources",
                <Layers />,
                () => showMenu("sources"),
                false,
                menu === "sources",
              )}
              {icon(
                "Settings",
                <Settings />,
                () => showMenu("settings"),
                false,
                menu === "settings",
              )}
              {icon(
                "Picture in picture",
                <PictureInPicture2 />,
                () => {
                  const action = document.pictureInPictureElement
                    ? document.exitPictureInPicture()
                    : video.current?.requestPictureInPicture?.();
                  void action?.catch(() =>
                    setError("Picture in picture is unavailable."),
                  );
                },
                !document.pictureInPictureEnabled,
              )}
              {icon(
                "Fullscreen (F)",
                <Maximize />,
                () =>
                  void fullscreen()?.catch(() =>
                    setError("Fullscreen is unavailable."),
                  ),
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
