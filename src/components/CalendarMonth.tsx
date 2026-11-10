import React, { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CalendarRelease, dateKey, monthGrid } from "../utils/animeSchedule";
import { getDisplayTitle } from "../utils/schedule";
export function CalendarMonth({
  month,
  onMonth,
  entries,
  selected,
  onSelect,
  onClose,
  onDay,
  controls,
  status,
  loading,
}: {
  month: Date;
  onMonth: (date: Date) => void;
  entries: Map<string, CalendarRelease[]>;
  selected: Date;
  onSelect: (release: CalendarRelease) => void;
  onClose: () => void;
  onDay: (date: Date) => void;
  controls: React.ReactNode;
  status: React.ReactNode;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState<{
    date: Date;
    left: number;
    top: number;
  } | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setExpanded(null);
  }, [month]);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        !popup.current?.contains(target) &&
        !target.closest("[data-calendar-date]")
      )
        setExpanded(null);
    };
    const close = (event: Event) => {
      if (
        event.type === "scroll" &&
        popup.current?.contains(event.target as Node)
      )
        return;
      setExpanded(null);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [expanded]);
  useEffect(() => {
    const root = document.getElementById("root"),
      wasInert = root?.hasAttribute("inert");
    root?.setAttribute("inert", "");
    return () => {
      if (!wasInert) root?.removeAttribute("inert");
    };
  }, []);
  const releases = expanded ? entries.get(dateKey(expanded.date)) || [] : [];
  return (
    <Modal
      isOpen
      onRequestClose={onClose}
      contentLabel="Monthly anime calendar"
      ariaHideApp={false}
      shouldCloseOnOverlayClick
      shouldReturnFocusAfterClose
      className="calendar-month-modal"
      overlayClassName="calendar-month-overlay"
    >
      <div
        onKeyDownCapture={(event) => {
          if (event.key === "Escape" && expanded) {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(null);
          }
        }}
      >
        <header className="calendar-month-heading">
          <div className="calendar-month-navigation">
            <button
              className="calendar-icon"
              aria-label="Previous month"
              onClick={() =>
                onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={20} />
            </button>
            <h2>
              {month.toLocaleDateString([], { month: "long", year: "numeric" })}
            </h2>
            <button
              className="calendar-icon"
              aria-label="Next month"
              onClick={() =>
                onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={20} />
            </button>
            <button
              className="calendar-today"
              onClick={() =>
                onMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
            >
              This month
            </button>
          </div>
          <button
            className="calendar-icon"
            aria-label="Close monthly calendar"
            onClick={onClose}
          >
            <X size={23} />
          </button>
        </header>
        {controls}
        <div className="calendar-month-scroll" aria-busy={loading}>
          <div className="calendar-month-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-month-grid">
            {monthGrid(month).days.map((date) => {
              const list = entries.get(dateKey(date)) || [],
                art = list.find(
                  (release) =>
                    release.anime.bannerImage ||
                    release.anime.coverImage?.extraLarge,
                )?.anime;
              return (
                <button
                  key={dateKey(date)}
                  data-calendar-date={dateKey(date)}
                  className={
                    "calendar-month-cell" +
                    (date.getMonth() !== month.getMonth()
                      ? " is-outside"
                      : "") +
                    (dateKey(date) === dateKey(new Date()) ? " is-today" : "") +
                    (expanded && dateKey(date) === dateKey(expanded.date)
                      ? " is-selected"
                      : "")
                  }
                  aria-label={
                    date.toLocaleDateString([], {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }) + `, ${list.length} releases`
                  }
                  aria-expanded={
                    !!expanded && dateKey(date) === dateKey(expanded.date)
                  }
                  aria-controls={
                    expanded && dateKey(date) === dateKey(expanded.date)
                      ? "calendar-date-popover"
                      : undefined
                  }
                  onClick={(event) => {
                    const box = event.currentTarget.getBoundingClientRect(),
                      width = Math.min(360, window.innerWidth - 24);
                    const left =
                      box.right + width + 12 < window.innerWidth
                        ? box.right + 8
                        : box.left - width - 8;
                    setExpanded((previous) =>
                      previous && dateKey(previous.date) === dateKey(date)
                        ? null
                        : {
                            date,
                            left: Math.max(
                              12,
                              Math.min(left, window.innerWidth - width - 12),
                            ),
                            top: Math.max(
                              20,
                              Math.min(box.top, window.innerHeight - 240),
                            ),
                          },
                    );
                  }}
                >
                  {art && (
                    <img
                      className="calendar-cell-art"
                      src={art.bannerImage || art.coverImage?.extraLarge}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <span className="calendar-cell-date">
                    <strong>{date.getDate()}</strong>
                    <small>{list.length || ""}</small>
                  </span>
                  <span className="calendar-cell-releases">
                    {list.slice(0, 4).map((release) => (
                      <span key={release.key}>
                        <i className={release.language} />
                        <span>{getDisplayTitle(release.anime)}</span>
                        <small>Ep {release.episode}</small>
                      </span>
                    ))}
                    {list.length > 4 && <em>+{list.length - 4} more</em>}
                    {loading && !list.length && <em>Loading...</em>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {status}
        {expanded && (
          <div
            ref={popup}
            id="calendar-date-popover"
            role="region"
            aria-label="Releases for selected date"
            className="calendar-date-popover"
            style={{
              left: expanded.left,
              top: expanded.top,
              maxHeight: window.innerHeight - expanded.top - 16,
            }}
          >
            <header>
              <strong>
                {expanded.date.toLocaleDateString([], {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </strong>
              <button
                className="calendar-icon"
                aria-label="Close date releases"
                onClick={() => setExpanded(null)}
              >
                <X size={16} />
              </button>
            </header>
            {loading ? (
              <p role="status">Loading releases...</p>
            ) : releases.length ? (
              releases.map((release) => (
                <button
                  className="calendar-popover-release"
                  key={release.key}
                  onClick={() => onSelect(release)}
                >
                  <i className={release.language} />
                  <span>
                    <strong>{getDisplayTitle(release.anime)}</strong>
                    <small>
                      {release.language.toUpperCase()} · Episode{" "}
                      {release.episode}
                    </small>
                  </span>
                  <time dateTime={new Date(release.at).toISOString()}>
                    {new Date(release.at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </button>
              ))
            ) : (
              <p>No scheduled releases match this date and your filters.</p>
            )}
            <button
              className="calendar-show-day"
              onClick={() => onDay(expanded.date)}
            >
              Show this day
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
