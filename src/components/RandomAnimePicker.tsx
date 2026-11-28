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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const skipFocusRestoreRef = useRef(false);

  const filtered = useMemo(
    () => anime.filter((item) => item.coverImage?.extraLarge && item.title),
    [anime],
  );
  const filteredRef = useRef(filtered);
  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const pickRandom = useCallback(() => {
    const list = filteredRef.current;
    if (list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }, []);

  const settle = useCallback(() => {
    setSelected(pickRandom());
    setSpinning(false);
    timerRef.current = null;
  }, [pickRandom]);

  const startSpin = useCallback(() => {
    const list = filteredRef.current;
    if (list.length === 0) return;
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
        next = Math.floor(Math.random() * list.length);
      } while (list.length > 1 && next === lastIndex);
      lastIndex = next;
      setSpinIndex(next);
      timerRef.current = setTimeout(tick, SPIN_INTERVAL_MS);
    };
    timerRef.current = setTimeout(tick, SPIN_INTERVAL_MS);
  }, [settle]);

  const hasEntries = filtered.length > 0;

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
  }, [open, hasEntries, startSpin]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    skipFocusRestoreRef.current = false;
    closeButtonRef.current?.focus();
    return () => {
      if (!skipFocusRestoreRef.current) {
        const target = returnFocusRef.current;
        if (target && document.contains(target)) target.focus();
      }
      returnFocusRef.current = null;
    };
  }, [open]);

  const close = (restoreFocus = true) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!restoreFocus) skipFocusRestoreRef.current = true;
    onClose();
  };

  const choose = (action: (anime: LibraryAnime) => void) => {
    if (!selected || spinning) return;
    skipFocusRestoreRef.current = true;
    action(selected);
    close(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") || [],
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
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
      <div
        className="random-picker-backdrop"
        onClick={() => close()}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="random-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a random anime"
        onKeyDown={handleKeyDown}
      >
        <header className="random-picker-header">
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close picker"
            onClick={() => close()}
          >
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
