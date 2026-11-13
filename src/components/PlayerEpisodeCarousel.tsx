import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { namedEpisodeTitle, type EpisodeMetadata } from "../utils/episodeMetadata";

export function PlayerEpisodeCarousel({
  episode,
  numbers,
  episodes,
  watchedThrough = 0,
  onSelect,
  onClose,
}: {
  episode: number;
  numbers: number[];
  episodes: Record<string, EpisodeMetadata>;
  watchedThrough?: number;
  onSelect: (episode: number) => void;
  onClose: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [center, setCenter] = useState(episode);
  const target = useRef<number | null>(null);

  function centerCard(number: number, smooth: boolean) {
    const row = strip.current;
    const card = row?.querySelector<HTMLElement>(`[data-episode="${number}"]`);
    if (!row || !card) return;
    row.scrollTo({
      left: card.offsetLeft + (card.offsetWidth - row.clientWidth) / 2,
      behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "smooth"
        : "auto",
    });
  }

  useLayoutEffect(() => {
    panel.current?.focus({ preventScroll: true });
    centerCard(episode, false);
  }, [episode]);

  useEffect(() => {
    const row = strip.current;
    if (!row) return;
    let timer: number | undefined;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (timer !== undefined) return;
      const width = (row.firstElementChild as HTMLElement | null)?.offsetWidth;
      if (!width) return;
      const current = target.current ?? Math.round(row.scrollLeft / width) + 1;
      const next = Math.min(numbers.length, Math.max(1, current + Math.sign(event.deltaY)));
      target.current = next;
      centerCard(next, true);
      timer = window.setTimeout(() => { timer = undefined; }, 280);
    };
    row.addEventListener("wheel", wheel, { passive: false });
    return () => {
      row.removeEventListener("wheel", wheel);
      window.clearTimeout(timer);
    };
  }, [numbers.length]);

  const move = (direction: number) => {
    const next = Math.max(1, Math.min(numbers.length, (target.current ?? center) + direction));
    target.current = next;
    centerCard(next, true);
  };

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="apex-player-episodes apex-episode-carousel"
      aria-label="Episodes"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        } else if (event.key === "Enter" && event.target === panel.current) {
          event.preventDefault();
          onSelect(center);
        }
      }}
    >
      <header>
        <h2>Episodes</h2>
        <button type="button" className="apex-player-close" aria-label="Close episodes" onClick={onClose}>
          <X size={15} />
        </button>
      </header>
      <div className="apex-carousel-stage">
        <div
          className="apex-carousel-strip"
          ref={strip}
          onPointerDown={() => { target.current = null; }}
          onScroll={(event) => {
            const row = event.currentTarget;
            const slot = row.firstElementChild as HTMLElement | null;
            if (!slot?.offsetWidth) return;
            const next = Math.min(numbers.length, Math.round(row.scrollLeft / slot.offsetWidth) + 1);
            if (target.current === next) target.current = null;
            setCenter(next);
          }}
        >
          {numbers.map((number) => {
            const title = namedEpisodeTitle(episodes[number]?.title, number);
            const isWatched = number <= watchedThrough;
            return (
              <div className="apex-carousel-slot" data-episode={number} key={number}>
                <button
                  type="button"
                  className="apex-carousel-card"
                  data-position={number === center ? "center" : number < center ? "left" : "right"}
                  aria-current={number === episode ? "true" : undefined}
                  aria-label={`Episode ${number}${title ? ` · ${title}` : ""}${isWatched ? ", watched" : ""}`}
                  tabIndex={number === center ? 0 : -1}
                  onClick={() => onSelect(number)}
                >
                  {episodes[number]?.image && <img src={episodes[number].image} alt="" loading="lazy" />}
                  {isWatched && <Check className="apex-episode-watched" size={20} aria-hidden="true" />}
                  <span>{title ? <><b>E{number}</b>{title}</> : `Episode ${number}`}</span>
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="apex-carousel-arrow is-left" aria-label="Browse previous episode" disabled={center <= 1} onClick={() => move(-1)}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="apex-carousel-arrow is-right" aria-label="Browse next episode" disabled={center >= numbers.length} onClick={() => move(1)}>
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
