import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { DashboardAnime } from "./HomeDashboard";
import type { useAccounts } from "../hooks/useAccounts";
import { getDisplayTitle } from "../utils/schedule";
import {
  CalendarPreferences,
  CalendarRelease,
  CalendarResult,
  dateKey,
  fetchCalendarRange,
  filterCalendar,
  monthGrid,
  readCalendarPreferences,
  ScheduleLanguage,
  sundayWeek,
} from "../utils/animeSchedule";
import { StyledSelect } from "./StyledSelect";
import { CalendarMonth } from "./CalendarMonth";
import { ScheduleFinale } from "./ScheduleFinale";
import "./animeCalendar.css";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const formats = [
  ["all", "All types"],
  ["TV", "TV"],
  ["TV_SHORT", "TV Short"],
  ["ONA", "ONA"],
  ["MOVIE", "Movie"],
  ["OVA", "OVA"],
  ["SPECIAL", "Special"],
];
export function ScheduleLanguageToggle({
  value,
  onChange,
  label = "Schedule language",
}: {
  value: ScheduleLanguage;
  onChange: (value: ScheduleLanguage) => void;
  label?: string;
}) {
  return (
    <div className="calendar-language" role="group" aria-label={label}>
      {(["all", "sub", "dub"] as const).map((language) => (
        <button
          key={language}
          aria-pressed={language === value}
          onClick={() => onChange(language)}
        >
          {language === "all" ? "All" : language === "sub" ? "Sub" : "Dub"}
        </button>
      ))}
    </div>
  );
}
function relativeRelease(at: number, now: number) {
  const minutes = Math.ceil((at - now) / 60000);
  if (minutes <= 0) return "Aired";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `in ${hours}h${minutes % 60 ? " " + (minutes % 60) + "m" : ""}`;
  return "in " + Math.ceil(hours / 24) + "d";
}
export function ScheduleCard({
  release,
  now,
  onSelect,
}: {
  release: CalendarRelease;
  now: number;
  onSelect: (release: CalendarRelease) => void;
}) {
  const [failed, setFailed] = useState(false);
  const image =
    release.anime.bannerImage || release.anime.coverImage?.extraLarge;
  return (
    <button
      className="calendar-release-card"
      onClick={() => onSelect(release)}
      title={getDisplayTitle(release.anime)}
    >
      <span className="calendar-release-art">
        {image && !failed ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="calendar-art-fallback">
            <CalendarDays size={28} />
          </span>
        )}
        <span className="calendar-language-badge">
          {release.language.toUpperCase()}
        </span>
        <span
          className={
            "calendar-countdown" + (release.at > now ? " is-upcoming" : "")
          }
        >
          {relativeRelease(release.at, now)}
        </span>
      </span>
      <strong>{getDisplayTitle(release.anime)}</strong>
      <span className="calendar-release-time">
        <time dateTime={new Date(release.at).toISOString()}>
          {new Date(release.at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
        <span> · Episode {release.episode}</span>
        <ScheduleFinale release={release} />
      </span>
      {release.note &&
        !["aired", "airing", "upcoming"].includes(
          release.note.toLowerCase(),
        ) && <small className="calendar-release-note">{release.note}</small>}
    </button>
  );
}
export const DubScheduleView = ({
  onSelectMedia,
  accounts,
}: {
  onSelectMedia: (
    anime: DashboardAnime,
    startEpisode?: number,
    startStream?: string | null,
  ) => void;
  accounts: ReturnType<typeof useAccounts>;
}) => {
  const [preferences, setPreferences] = useState<CalendarPreferences>(
    readCalendarPreferences,
  );
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date());
  const [monthOpen, setMonthOpen] = useState(false),
    [search, setSearch] = useState(""),
    [reload, setReload] = useState(0);
  const [result, setResult] = useState<CalendarResult>({
    entries: [],
    warnings: [],
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [now, setNow] = useState(Date.now());
  const lastReload = useRef(0);
  const week = sundayWeek(selected),
    grid = monthGrid(month);
  const start = +(monthOpen ? grid.start : week.start),
    end = +(monthOpen ? grid.end : week.end);
  useEffect(() => {
    try {
      localStorage.setItem(
        "apex_calendar_preferences_v1",
        JSON.stringify(preferences),
      );
    } catch {}
  }, [preferences]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const force = reload !== lastReload.current;
    lastReload.current = reload;
    setLoading(true);
    setResult({ entries: [], warnings: [], updatedAt: null });
    void fetchCalendarRange(
      new Date(start),
      new Date(end),
      preferences.language,
      controller.signal,
      force,
    )
      .then((next) => {
        if (!controller.signal.aborted) setResult(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            entries: [],
            warnings: ["The schedule could not load. Please retry."],
            updatedAt: null,
          });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [start, end, preferences.language, reload]);
  const filtered = useMemo(
    () =>
      filterCalendar(
        result.entries,
        preferences,
        search,
        accounts.libraryEntries,
      ),
    [result.entries, preferences, search, accounts.libraryEntries],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarRelease[]>();
    for (const release of filtered) {
      const key = dateKey(new Date(release.at));
      map.set(key, [...(map.get(key) || []), release]);
    }
    return map;
  }, [filtered]);
  const entries = grouped.get(dateKey(selected)) || [];
  const setPreference = <K extends keyof CalendarPreferences>(
    key: K,
    value: CalendarPreferences[K],
  ) => setPreferences((previous) => ({ ...previous, [key]: value }));
  const selectRelease = (release: CalendarRelease) => {
    if (!release.anime.id && !release.anime.idMal) {
      setNotice(
        "This release has no confirmed anime match yet. Please refresh later.",
      );
      return;
    }
    setNotice("");
    setMonthOpen(false);
    onSelectMedia(
      { ...release.anime, releaseEpisode: release.episode },
      release.episode,
    );
  };
  const shiftWeek = (amount: number) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + amount * 7);
    setSelected(next);
  };
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
  const controls = (overlay = false) => (
    <div className="calendar-controls">
      <ScheduleLanguageToggle
        label={overlay ? "Monthly schedule language" : "Schedule language"}
        value={preferences.language}
        onChange={(value) => setPreference("language", value)}
      />
      <details className="calendar-filter">
        <summary
          aria-label={overlay ? "Monthly schedule filters" : "Schedule filters"}
          title="Filter schedule"
        >
          <SlidersHorizontal size={17} />
        </summary>
        <div className="calendar-filter-menu">
          <label>
            Shows
            <StyledSelect
              aria-label={overlay ? "Monthly shows" : "Schedule shows"}
              value={preferences.scope}
              onChange={(event) =>
                setPreference(
                  "scope",
                  event.target.value as "discover" | "yours",
                )
              }
            >
              <option value="discover">Discover</option>
              <option value="yours">Yours</option>
            </StyledSelect>
          </label>
          <label>
            Type
            <StyledSelect
              aria-label={overlay ? "Monthly anime type" : "Anime type"}
              value={preferences.format}
              onChange={(event) => setPreference("format", event.target.value)}
            >
              {formats.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </StyledSelect>
          </label>
        </div>
      </details>
      <StyledSelect
        aria-label={overlay ? "Sort monthly schedule" : "Sort schedule"}
        value={preferences.sort}
        onChange={(event) =>
          setPreference(
            "sort",
            event.target.value as CalendarPreferences["sort"],
          )
        }
      >
        <option value="time">Time: earliest</option>
        <option value="latest">Time: latest</option>
        <option value="title">Title A-Z</option>
      </StyledSelect>
      <label className="calendar-search">
        <Search size={16} />
        <input
          aria-label={overlay ? "Search monthly schedule" : "Search schedule"}
          placeholder="Search schedule"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
    </div>
  );
  const status = (
    <div className="calendar-source-status" aria-live="polite">
      {loading ? (
        <span role="status">Loading releases...</span>
      ) : result.updatedAt ? (
        <span>
          Updated{" "}
          {new Date(result.updatedAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          · {timezone}
        </span>
      ) : (
        <span>{timezone}</span>
      )}
      {result.warnings.map((warning) => (
        <p role="status" key={warning}>
          {warning}
        </p>
      ))}
    </div>
  );
  return (
    <section className="anime-calendar" aria-label="Anime schedule">
      <header className="calendar-heading">
        <h1>Schedule</h1>
        <div className="calendar-heading-actions">
          {controls()}
          <button
            className="calendar-icon"
            aria-label="Open monthly calendar"
            title="Monthly calendar"
            onClick={() => {
              setMonth(
                new Date(selected.getFullYear(), selected.getMonth(), 1),
              );
              setMonthOpen(true);
            }}
          >
            <CalendarDays size={20} />
          </button>
          <button
            className="calendar-icon"
            aria-label="Refresh schedule"
            title="Refresh"
            disabled={loading}
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw
              size={17}
              className={loading ? "calendar-loading-icon" : ""}
            />
          </button>
        </div>
      </header>
      <div className="calendar-week-navigation">
        <button
          className="calendar-icon"
          aria-label="Previous week"
          onClick={() => shiftWeek(-1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          {week.start.toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}{" "}
          -{" "}
          {new Date(+week.end - 1).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <button
          className="calendar-icon"
          aria-label="Next week"
          onClick={() => shiftWeek(1)}
        >
          <ChevronRight size={17} />
        </button>
        <button
          className="calendar-today"
          onClick={() => setSelected(new Date())}
        >
          Today
        </button>
      </div>
      <div
        className="calendar-week-tabs"
        role="tablist"
        aria-label="Days of the week"
      >
        {days.map((name, index) => {
          const date = new Date(week.start);
          date.setDate(date.getDate() + index);
          return (
            <button
              key={name}
              role="tab"
              aria-selected={dateKey(date) === dateKey(selected)}
              aria-controls="calendar-day-releases"
              id={`schedule-day-${index}`}
              tabIndex={dateKey(date) === dateKey(selected) ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const target =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 6
                        : (index + (event.key === "ArrowRight" ? 1 : 6)) % 7;
                  const next = new Date(week.start);
                  next.setDate(next.getDate() + target);
                  setSelected(next);
                  document.getElementById(`schedule-day-${target}`)?.focus();
                }
              }}
              onClick={() => setSelected(date)}
            >
              {name}
              <small>{(grouped.get(dateKey(date)) || []).length}</small>
              {dateKey(date) === dateKey(new Date(now)) && (
                <i aria-label="Today" />
              )}
            </button>
          );
        })}
      </div>
      {notice && (
        <p className="calendar-notice" role="alert">
          {notice}
        </p>
      )}
      <div
        role="tabpanel"
        id="calendar-day-releases"
        aria-labelledby={`schedule-day-${selected.getDay()}`}
        aria-busy={loading}
      >
        <p className="calendar-selected-date">
          {selected.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {preferences.scope === "yours" ? " · Your anime" : ""}
        </p>
        {loading ? (
          <div
            className="calendar-card-grid calendar-skeleton"
            aria-hidden="true"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} />
            ))}
          </div>
        ) : entries.length ? (
          <div className="calendar-card-grid">
            {entries.map((release) => (
              <ScheduleCard
                key={release.key}
                release={release}
                now={now}
                onSelect={selectRelease}
              />
            ))}
          </div>
        ) : (
          <div className="calendar-empty">
            <CalendarDays size={26} />
            <p>
              {preferences.scope === "yours" && !accounts.libraryEntries.length
                ? "Your library is empty or not connected. Connect your accounts in Settings, or switch to Discover."
                : result.warnings.length
                  ? "No releases loaded for this day. Try refreshing or changing the filters."
                  : "No scheduled releases match this day and your filters."}
            </p>
          </div>
        )}
      </div>
      {status}
      <p className="calendar-source-note">
        Sub times are Japanese broadcasts from AniList; streaming availability
        may vary. Dub times are from the Asuna timetable. Future dates appear
        when the sources publish them.
      </p>
      {monthOpen && (
        <CalendarMonth
          month={month}
          onMonth={setMonth}
          entries={grouped}
          selected={selected}
          onSelect={selectRelease}
          onClose={() => setMonthOpen(false)}
          controls={controls(true)}
          status={status}
          loading={loading}
          onDay={(date) => {
            setSelected(date);
            setMonthOpen(false);
          }}
        />
      )}
    </section>
  );
};
