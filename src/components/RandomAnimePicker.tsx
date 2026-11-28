import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dice5, Info, Play, X } from "lucide-react";
import type { LibraryAnime } from "../hooks/useLibrary";
import { getDisplayTitle } from "../utils/schedule";

interface RandomAnimePickerProps {
  anime: LibraryAnime[];
  open: boolean;
  onPlay: (anime: LibraryAnime) => void;
  onSelect: (anime: LibraryAnime) => void;
  onClose: () => void;
}

export const SPIN_DURATION_MS = 2200;
const SPIN_INTERVAL_MS = 120;

function formatLabel(value?: string): string {
  if (!value) return "";
  switch (value) {
    case "TV_SHORT":
      return "TV Short";
    case "MOVIE":
      return "Movie";
    case "SPECIAL":
      return "Special";
    default:
      return value;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return !!window.matchMedia("(prefers-reduced-motion: reduce)")?.matches;
}

export function RandomAnimePicker({
  anime,
  open,
  onPlay,
  onSelect,
  onClose,
}: RandomAnimePickerProps) {
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<LibraryAnime | null>(null);
  const [spinIndex, setSpinIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(
    () => anime.filter((item) => item.coverImage?.extraLarge && item.title),
    [anime],
  );

  const pickRandom = useCallback(() => {
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }, [filtered]);

  const settle = useCallback(() => {
    setSelected(pickRandom());
    setSpinning(false);
    timerRef.current = null;
  }, [pickRandom]);

  const startSpin = useCallback(() => {
    if (filtered.length === 0) return;
    if (prefersReducedMotion()) {
      settle();
      return;
    }
    setSpinning(true);
    setSelected(null);
    let remaining = SPIN_DURATION_MS;
    let lastIndex = -1;
    const tick = () => {
      remaining -= SPIN_INTERVAL_MS;
      if (remaining <= 0) {
        settle();
        return;
      }
      let next: number;
      do {
        next = Math.floor(Math.random() * filtered.length);
      } while (filtered.length > 1 && next === lastIndex);
      lastIndex = next;
      setSpinIndex(next);
      timerRef.current = setTimeout(tick, SPIN_INTERVAL_MS);
    };
    timerRef.current = setTimeout(tick, SPIN_INTERVAL_MS);
  }, [filtered, settle]);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setSpinning(false);
      setSelected(null);
      return;
    }
    startSpin();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, startSpin]);

  const close = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onClose();
  };

  const choose = (action: (anime: LibraryAnime) => void) => {
    if (!selected || spinning) return;
    action(selected);
    close();
  };

  if (!open || filtered.length === 0) return null;

  const poster = spinning
    ? filtered[spinIndex]?.coverImage?.extraLarge
    : selected?.coverImage?.extraLarge;
  const subtitle = [
    formatLabel(selected?.format),
    selected?.startYear ? String(selected.startYear) : "",
    Number.isFinite(selected?.averageScore) && (selected?.averageScore || 0) > 0
      ? `★ ${(selected!.averageScore! / 10).toFixed(1)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="random-picker-backdrop" onClick={close} aria-hidden="true" />
      <div
        className="random-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a random anime"
      >
        <header className="random-picker-header">
          <span className="random-picker-tag">Tonight, watch</span>
          <button type="button" aria-label="Close picker" onClick={close}>
            <X size={20} />
          </button>
        </header>
        <div className="random-picker-poster">
          {poster ? (
            <img
              className={`random-picker-image${spinning ? " random-picker-spinning" : ""}`}
              src={poster}
              alt={spinning ? "" : selected ? getDisplayTitle(selected) : ""}
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </div>
        <h2 className="random-picker-title">
          {selected ? getDisplayTitle(selected) : "—"}
        </h2>
        {subtitle && <p className="random-picker-subtitle">{subtitle}</p>}
        <div className="random-picker-actions">
          <button
            type="button"
            className="random-picker-btn random-picker-btn-play"
            disabled={!selected || spinning}
            onClick={() => choose(onPlay)}
          >
            <Play size={16} /> Play
          </button>
          <button
            type="button"
            className="random-picker-btn random-picker-btn-details"
            disabled={!selected || spinning}
            onClick={() => choose(onSelect)}
          >
            <Info size={16} /> Details
          </button>
          <button
            type="button"
            className="random-picker-btn random-picker-btn-again"
            disabled={spinning}
            onClick={startSpin}
          >
            <Dice5 size={16} /> Spin again
          </button>
        </div>
      </div>
    </>
  );
}
