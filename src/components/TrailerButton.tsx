import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Film, X } from "lucide-react";
import "./trailer.css";
export interface TrailerMetadata {
  id?: string | null;
  site?: string | null;
}
export function youtubeTrailerId(
  trailer?: TrailerMetadata | null,
): string | null {
  return trailer?.site?.trim().toLowerCase() === "youtube" &&
    typeof trailer.id === "string" &&
    /^[A-Za-z0-9_-]{11}$/.test(trailer.id.trim())
    ? trailer.id.trim()
    : null;
}
export function TrailerButton({
  trailer,
  title,
}: {
  trailer?: TrailerMetadata | null;
  title: string;
}) {
  const videoId = youtubeTrailerId(trailer);
  const [open, setOpen] = useState(false),
    [mounted, setMounted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const heading = useId(),
    description = useId();
  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      trigger.current?.focus();
    };
  }, [mounted]);
  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open, mounted]);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, [open]);
  if (!videoId) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="detail-trailer-button glass"
        aria-label="Watch official trailer"
        title="Trailer"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <Film size={19} aria-hidden="true" />
      </button>
      {mounted &&
        createPortal(
          <div
            className={"trailer-overlay" + (open ? " is-open" : " is-closing")}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={heading}
              aria-describedby={description}
              className="trailer-dialog"
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const focusable = Array.from(
                  panel.current?.querySelectorAll<HTMLElement>(
                    "button,iframe",
                  ) || [],
                );
                const first = focusable[0],
                  last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }}
            >
              <header>
                <Film size={22} aria-hidden="true" />
                <div>
                  <h2 id={heading}>Official Trailer</h2>
                  <p id={description}>{title}</p>
                </div>
                <button
                  ref={closeButton}
                  type="button"
                  onClick={close}
                  aria-label="Close trailer"
                >
                  <X size={20} />
                </button>
              </header>
              <div className="trailer-video">
                {open && (
                  <iframe
                    src={
                      "https://www.youtube-nocookie.com/embed/" +
                      videoId +
                      "?autoplay=1&controls=1&playsinline=1&rel=0"
                    }
                    title={title + " — official YouTube trailer"}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
