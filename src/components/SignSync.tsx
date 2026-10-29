import React, { RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Captions, Sparkles, X } from "lucide-react";
import "./signSync.css";
interface Cue {
  start: number;
  end: number;
  text: string;
}
interface Track {
  id: string;
  label: string;
  cues: Cue[];
}
export function SignSync({
  animeId,
  episode,
  language,
  root,
  position,
}: {
  animeId: number;
  episode: number;
  language: string;
  root: RefObject<HTMLDivElement>;
  position: () => number;
}) {
  const settingKey = `apex_signsync_v1_${animeId}_${language}`;
  const saved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(settingKey) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };
  const [open, setOpen] = useState(false),
    [tracks, setTracks] = useState<Track[]>([]),
    [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [delay, setDelay] = useState<number>(() =>
    Math.max(-120, Math.min(120, Number(saved().delay) || 0)),
  );
  const [follow, setFollow] = useState<boolean>(() => saved().follow === true);
  const [visible, setVisible] = useState<string[]>([]);
  const button = useRef<HTMLButtonElement>(null),
    close = useRef<HTMLButtonElement>(null),
    request = useRef<AbortController>();
  const currentPosition = useRef(position);
  currentPosition.current = position;
  const search = async () => {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setBusy(true);
    setMessage("Searching this episode’s English Signs & Songs…");
    try {
      const response = await fetch(
        `/api/signsync?id=${animeId}&episode=${episode}`,
        { signal: abort.signal },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Subtitle search failed.");
      if (abort.signal.aborted) return;
      const valid: Track[] = (
        Array.isArray(data.tracks) ? data.tracks : []
      ).filter(
        (track: Track) =>
          track &&
          typeof track.id === "string" &&
          typeof track.label === "string" &&
          Array.isArray(track.cues),
      );
      setTracks(valid);
      if (valid.length) setSelected(valid[0].id);
      setMessage(data.message || "No matching subtitles found.");
    } catch (error) {
      if (!abort.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : "Subtitle search failed.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  };
  useEffect(() => {
    if (follow) void search();
    return () => request.current?.abort();
    // Each player mounts a new instance for the exact episode and audio language.
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(settingKey, JSON.stringify({ delay, follow }));
    } catch {}
  }, [settingKey, delay, follow]);
  useEffect(() => {
    const cues = tracks.find((track) => track.id === selected)?.cues;
    if (!cues) {
      setVisible([]);
      return;
    }
    const tick = () => {
      const time = currentPosition.current() - delay;
      const next = cues
        .filter(
          (c) =>
            Number.isFinite(c.start) &&
            Number.isFinite(c.end) &&
            time >= c.start &&
            time < c.end,
        )
        .slice(0, 4)
        .map((c) => String(c.text));
      setVisible((prev) => (prev.join("\n") === next.join("\n") ? prev : next));
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [selected, tracks, delay]);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    const fullscreen = () => {
      if (document.fullscreenElement) setOpen(false);
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [open]);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="player-header-icon signsync-trigger"
        aria-label="SignSync subtitle tools"
        title="SignSync · Signs & Songs"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Captions size={19} aria-hidden="true" />
        <Sparkles className="signsync-sparkle" size={9} aria-hidden="true" />
      </button>
      {root.current &&
        createPortal(
          <>
            {visible.length > 0 && (
              <div
                className="signsync-captions"
                aria-label="SignSync subtitles"
              >
                {visible.map((text, i) => (
                  <div key={i}>{text}</div>
                ))}
              </div>
            )}
            {open && (
              <section
                className="signsync-panel"
                role="dialog"
                aria-label="SignSync subtitle tools"
              >
                <header>
                  <h2>SignSync</h2>
                  <button
                    ref={close}
                    type="button"
                    aria-label="Close SignSync"
                    onClick={() => {
                      setOpen(false);
                      button.current?.focus();
                    }}
                  >
                    <X size={18} />
                  </button>
                </header>
                <p>English · Signs &amp; Songs</p>
                <button
                  className="signsync-find"
                  disabled={busy}
                  onClick={() => void search()}
                >
                  {busy ? "Searching…" : "Find subtitles"}
                </button>
                {message && <p role="status">{message}</p>}
                {tracks.length > 0 && (
                  <label>
                    Subtitle source
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="">Off</option>
                      {tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Timing{" "}
                  <input
                    aria-label="SignSync timing in seconds"
                    type="number"
                    min={-120}
                    max={120}
                    step={0.1}
                    value={delay}
                    onChange={(e) =>
                      setDelay(
                        Math.max(
                          -120,
                          Math.min(120, Number(e.target.value) || 0),
                        ),
                      )
                    }
                  />
                </label>
                <input
                  aria-label="Adjust SignSync timing"
                  type="range"
                  min={-10}
                  max={10}
                  step={0.1}
                  value={Math.max(-10, Math.min(10, delay))}
                  onChange={(e) => setDelay(Number(e.target.value))}
                />
                <small>
                  Positive seconds show text later.{" "}
                  <button onClick={() => setDelay(0)}>Reset</button>
                </small>
                <label className="signsync-follow">
                  Follow next episode
                  <input
                    type="checkbox"
                    checked={follow}
                    onChange={(e) => setFollow(e.target.checked)}
                  />
                </label>
                <button
                  onClick={() => {
                    request.current?.abort();
                    setSelected("");
                    setFollow(false);
                    setBusy(false);
                    setMessage(
                      "SignSync is off. Original player subtitles are unchanged.",
                    );
                  }}
                >
                  Turn SignSync off
                </button>
                <small>
                  Use the player’s CC menu for dialogue. SignSync displays
                  additional text; ASS fonts and positioning are simplified.
                </small>
              </section>
            )}
          </>,
          root.current,
        )}
    </>
  );
}
