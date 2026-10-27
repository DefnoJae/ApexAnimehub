import React, { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Compass,
  Check,
  ChevronRight,
  Home,
  History,
  Library,
  Bookmark,
  Pause,
  MinusCircle,
  Play,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { fetchAnilist } from "../utils/anilist";
import { fetchHeroArtwork, isTitleTreatment } from "../utils/heroArtwork";
import { fetchDubRange } from "../utils/dubSchedule";
import { getDisplayTitle } from "../utils/schedule";
import type { ListAnime, ListStatus, useAccounts } from "../hooks/useAccounts";
import { NotificationBell } from "./NotificationBell";
import { HeroBackdrop } from "./HeroBackdrop";
import "./dashboard.css";
import { sectionPaths } from "../hooks/usePageRoute";
import { useMissingLibrary } from "../hooks/useMissingLibrary";
import { AnimeBadges } from "./AnimeBadges";
import {
  fetchEpisodeMetadata,
  EpisodeMetadata,
} from "../utils/episodeMetadata";

export interface DashboardAnime extends ListAnime {
  title: { english?: string; romaji?: string };
  bannerImage?: string;
  coverImage?: { extraLarge?: string };
  logoImage?: string;
  averageScore?: number;
  description?: string;
  episode?: number;
}
export interface WatchEntry {
  anime: DashboardAnime;
  episode: number;
  streamName: string;
  timestamp: number;
  position?: number;
  duration?: number;
}
export function playbackPercent(entry: WatchEntry): number | null {
  if (
    !Number.isFinite(entry.position) ||
    !Number.isFinite(entry.duration) ||
    !entry.duration ||
    entry.duration <= 0 ||
    entry.position === undefined
  )
    return null;
  return Math.round(
    Math.max(0, Math.min(100, (entry.position / entry.duration) * 100)),
  );
}
type Accounts = ReturnType<typeof useAccounts>;
const statuses: Array<[ListStatus, string]> = [
  ["planning", "Planning"],
  ["watching", "Watching"],
  ["completed", "Completed"],
  ["paused", "On hold"],
  ["dropped", "Dropped"],
];

export function FloatingNavigation({
  view,
  onView,
  onSearch,
  onSettings,
  hidden,
  notificationFeed,
}: {
  view: string;
  onView: (view: string) => void;
  onSearch: () => void;
  onSettings: () => void;
  hidden: boolean;
  notificationFeed?: Accounts["notificationFeed"];
}) {
  return (
    <nav
      className={"apex-nav glass " + (hidden ? "nav-hidden" : "")}
      aria-label="Main navigation"
    >
      <a
        href="/"
        className="apex-brand"
        aria-label="ApexAnimehub home"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          onView("all");
        }}
      >
        <img src="/apex-logo.png" alt="" width="38" height="38" />
      </a>
      <span className="nav-divider" />
      {[
        { key: "all", label: "Home", Icon: Home },
        { key: "dub-releases", label: "Dub calendar", Icon: Calendar },
        { key: "my-list", label: "My List", Icon: Library },
        { key: "discover", label: "Discover anime", Icon: Compass },
      ].map(({ key, label, Icon }) => (
        <a
          href={sectionPaths[key]}
          key={key}
          title={label}
          aria-label={label}
          aria-current={view === key ? "page" : undefined}
          className={"nav-icon " + (view === key ? "active" : "")}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            onView(key);
          }}
        >
          <Icon size={20} />
          <span className="nav-tooltip">{label}</span>
        </a>
      ))}
      <span className="nav-divider" />
      <button
        className="nav-icon"
        title="Search anime"
        aria-label="Search anime"
        onClick={onSearch}
      >
        <Search size={20} />
        <span className="nav-tooltip">Search</span>
      </button>
      {notificationFeed && <NotificationBell feed={notificationFeed} />}
      <button
        className="nav-icon"
        title="Account settings"
        aria-label="Account settings"
        onClick={onSettings}
      >
        <Settings size={20} />
        <span className="nav-tooltip">Settings</span>
      </button>
    </nav>
  );
}

export function QuickList({
  anime,
  accounts,
  planning = false,
}: {
  anime: DashboardAnime;
  accounts: Accounts;
  planning?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [notice, setNotice] = useState("");
  const currentStatus = accounts.getListStatus?.(anime);
  const StatusIcon = currentStatus
    ? {
        planning: Bookmark,
        watching: Play,
        completed: Check,
        paused: Pause,
        dropped: MinusCircle,
      }[currentStatus]
    : Plus;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        container.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    container.current?.addEventListener("keydown", escape);
    const element = container.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      element?.removeEventListener("keydown", escape);
    };
  }, [open]);
  const update = async (status: ListStatus) => {
    setOpen(false);
    setNotice("Updating…");
    const result = await accounts.sync(
      anime,
      status,
      status === "completed" && anime.episodes ? anime.episodes : undefined,
    );
    setNotice(
      result.length && result.every((item) => item.success)
        ? "Saved"
        : "Open notifications for details",
    );
  };
  return (
    <div
      ref={container}
      className={"quick-list " + (planning ? "hero-list" : "")}
    >
      <button
        className={planning ? "hero-secondary glass" : "quick-add glass"}
        aria-label={
          (planning ? "Add to Planning: " : "Change list status: ") +
          getDisplayTitle(anime)
        }
        title={
          currentStatus
            ? statuses.find(([key]) => key === currentStatus)?.[1]
            : "Add to list"
        }
        aria-expanded={planning && !currentStatus ? undefined : open}
        onClick={() =>
          planning && !currentStatus
            ? void update("planning")
            : setOpen((value) => !value)
        }
        disabled={accounts.busy || accounts.checking}
      >
        <StatusIcon size={19} />
        {planning && (
          <span>
            {currentStatus
              ? statuses.find(([key]) => key === currentStatus)?.[1]
              : "Add to Planning"}
          </span>
        )}
      </button>
      {open && (
        <div
          className="status-popover glass"
          role="group"
          aria-label={"List status for " + getDisplayTitle(anime)}
        >
          {statuses.map(([status, label]) => (
            <button key={status} onClick={() => void update(status)}>
              {label}
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
      )}
      {notice && (
        <span className="quick-notice" role="status">
          {notice}
        </span>
      )}
    </div>
  );
}

export function PosterRow({
  title,
  animes,
  accounts,
  onSelect,
  notice,
}: {
  title: string;
  animes: DashboardAnime[];
  accounts: Accounts;
  onSelect: (anime: DashboardAnime) => void;
  notice?: string;
}) {
  if (!animes.length && !notice) return null;
  return (
    <section className="discovery-section home-poster-row" aria-label={title}>
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="poster-track">
        {animes.map((anime) => (
          <article className="poster-card" key={anime.id}>
            <div className="poster-art">
              <button
                className="poster-open"
                aria-label={"View details: " + getDisplayTitle(anime)}
                onClick={() => onSelect(anime)}
              >
                <img
                  loading="lazy"
                  src={anime.coverImage?.extraLarge}
                  alt={getDisplayTitle(anime)}
                />
                <span className="poster-hover">
                  <span>
                    View episodes <ChevronRight size={18} />
                  </span>
                  {anime.averageScore ? (
                    <small>★ {(anime.averageScore / 10).toFixed(1)}</small>
                  ) : null}
                </span>
              </button>
              <QuickList anime={anime} accounts={accounts} />
            </div>
            <button
              className="poster-title"
              title={getDisplayTitle(anime)}
              onClick={() => onSelect(anime)}
            >
              {getDisplayTitle(anime)}
            </button>
            <div className="home-poster-metadata">
              <AnimeBadges idMal={anime.idMal} />
            </div>
          </article>
        ))}
      </div>
      {notice && (
        <p className="home-row-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

function MissingLibraryRow({
  accounts,
  onSelect,
  onConnect,
}: {
  accounts: Accounts;
  onSelect: (anime: DashboardAnime) => void;
  onConnect?: () => void;
}) {
  const missing = useMissingLibrary(accounts);
  return (
    <div>
      <PosterRow
        title="Missing from Library"
        animes={missing.animes}
        notice={missing.notice}
        accounts={accounts}
        onSelect={onSelect}
      />
      {!missing.connected && onConnect && (
        <button className="home-row-action" onClick={onConnect}>
          Connect accounts
        </button>
      )}
      {missing.connected && missing.error && (
        <button className="home-row-action" onClick={missing.retry}>
          Try again
        </button>
      )}
    </div>
  );
}

function LatestEpisodes({
  language,
  setLanguage,
  onSelect,
  onCalendar,
}: {
  language: "sub" | "dub";
  setLanguage: (language: "sub" | "dub") => void;
  onSelect: (anime: DashboardAnime) => void;
  onCalendar: () => void;
}) {
  const [items, setItems] = useState<DashboardAnime[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    const load = async () => {
      if (language === "sub") {
        const data = await fetchAnilist<{
          Page: {
            airingSchedules: Array<{ episode: number; media: DashboardAnime }>;
          };
        }>(
          "query($now:Int,$since:Int){Page(page:1,perPage:30){airingSchedules(airingAt_lesser:$now,airingAt_greater:$since,sort:TIME_DESC){episode media{id idMal title{english romaji} bannerImage coverImage{extraLarge} episodes isAdult}}}}",
          {
            now: Math.floor(Date.now() / 1000),
            since: Math.floor(Date.now() / 1000) - 7 * 86400,
          },
        );
        return data.Page.airingSchedules
          .filter(
            (item) =>
              item.media &&
              !(item.media as DashboardAnime & { isAdult?: boolean }).isAdult,
          )
          .map((item) => ({ ...item.media, episode: item.episode }));
      }
      const end = new Date(),
        start = new Date(end.getTime() - 6 * 86400000);
      const result = await fetchDubRange(start, end);
      if (active && result.error)
        setError(
          "Some dub releases could not be refreshed. " +
            (result.cached
              ? "Showing cached releases."
              : "Try again or open the calendar."),
        );
      return result.entries
        .filter(
          (entry) =>
            Date.parse(entry.episodeDate) >= start.getTime() &&
            Date.parse(entry.episodeDate) <= end.getTime(),
        )
        .sort((a, b) => Date.parse(b.episodeDate) - Date.parse(a.episodeDate))
        .map((entry) => ({
          ...(entry.media?.media || { id: 0, title: { english: entry.title } }),
          episode: entry.episodeNumber,
        }));
    };
    void load()
      .then((next) => {
        if (active) setItems(next);
      })
      .catch(() => {
        if (active)
          setError("Latest episodes are unavailable. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language, retry]);
  return (
    <section className="discovery-section" aria-label="Latest Episodes">
      <div className="section-heading">
        <h2>Latest Episodes</h2>
        <div
          className="language-toggle glass"
          role="group"
          aria-label="Episode language"
        >
          {(["sub", "dub"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={language === value}
              onClick={() => setLanguage(value)}
            >
              {value === "sub" ? "Sub" : "Dub"}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="section-notice" role="status">
          {error}{" "}
          <button onClick={() => setRetry((value) => value + 1)}>Retry</button>
        </p>
      )}
      {loading ? (
        <div className="row-loading" role="status">
          Finding recent {language === "dub" ? "dubbed" : "subbed"} episodes…
        </div>
      ) : !items.length ? (
        <p className="section-notice">
          No recent releases available.{" "}
          <button onClick={onCalendar}>Browse the calendar</button>
        </p>
      ) : (
        <div className="episode-track">
          {items.map((anime, index) => (
            <button
              className="episode-card glass"
              key={anime.id + ":" + anime.episode + ":" + index}
              onClick={() =>
                anime.id || anime.idMal ? onSelect(anime) : onCalendar()
              }
            >
              <div>
                <img
                  loading="lazy"
                  src={anime.bannerImage || anime.coverImage?.extraLarge}
                  alt=""
                />
                <span className="episode-badge">
                  {language.toUpperCase()} · EP {anime.episode}
                </span>
              </div>
              <h3>{getDisplayTitle(anime)}</h3>
              {!anime.id && !anime.idMal && (
                <small>Find this release in the calendar</small>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function HomeDashboard({
  slides,
  rows,
  history,
  accounts,
  onSelect,
  onWatch,
  onResume,
  onRemove,
  onCalendar,
  onConnect,
}: {
  slides: DashboardAnime[];
  rows: Array<{ title: string; animes: DashboardAnime[]; notice?: string }>;
  history: WatchEntry[];
  accounts: Accounts;
  onSelect: (anime: DashboardAnime) => void;
  onWatch: (anime: DashboardAnime) => void;
  onResume: (entry: WatchEntry) => void;
  onRemove: (id: number) => void;
  onCalendar: () => void;
  onConnect?: () => void;
}) {
  const [episodeMetadata, setEpisodeMetadata] = useState<
    Record<string, EpisodeMetadata>
  >({});
  const episodeKeys = history
    .map((item) => `${item.anime.id}:${item.episode}`)
    .join(",");
  useEffect(() => {
    let active = true;
    const keys = episodeKeys ? episodeKeys.split(",") : [];
    Promise.allSettled(
      keys.map(async (key) => {
        const [id, episode] = key.split(":").map(Number);
        const episodes = await fetchEpisodeMetadata(id);
        return [key, episodes[String(episode)]] as const;
      }),
    ).then((results) => {
      if (!active) return;
      const metadata: Record<string, EpisodeMetadata> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value[1])
          metadata[result.value[0]] = result.value[1];
      });
      setEpisodeMetadata(metadata);
    });
    return () => {
      active = false;
    };
  }, [episodeKeys]);
  const [slide, setSlide] = useState(0),
    [paused, setPaused] = useState(false),
    [focusPaused, setFocusPaused] = useState(false),
    [pageHidden, setPageHidden] = useState(document.hidden);
  const [language, setLanguage] = useState<"sub" | "dub">(() => {
    try {
      return localStorage.getItem("apex_episode_language") === "dub"
        ? "dub"
        : "sub";
    } catch {
      return "sub";
    }
  });
  const [validatedLogo, setValidatedLogo] = useState<string | null>(null);
  const [artwork, setArtwork] = useState<{
    id: number;
    logos: string[];
  } | null>(null);
  const [logoIndex, setLogoIndex] = useState(0);
  const anime = slides[slide % Math.max(1, slides.length)],
    resume = history.find((item) => item.anime.id === anime?.id);
  useEffect(() => {
    let active = true;
    setLogoIndex(0);
    if (anime?.id) {
      void fetchHeroArtwork(anime.id).then((logos) => {
        if (active) setArtwork({ id: anime.id, logos });
      });
    }
    return () => {
      active = false;
    };
  }, [anime?.id, anime?.logoImage]);
  const titleLogo =
    artwork?.id === anime?.id ? artwork?.logos[logoIndex] : undefined;
  useEffect(() => {
    const changed = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (
      paused ||
      focusPaused ||
      pageHidden ||
      slides.length < 2 ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(
      () => setSlide((value) => (value + 1) % slides.length),
      8000,
    );
    return () => clearInterval(timer);
  }, [paused, focusPaused, pageHidden, slides.length, slide]);
  return (
    <div className="home-dashboard">
      {anime && (
        <section
          className={
            "cinematic-hero " + (paused || focusPaused ? "motion-paused" : "")
          }
          aria-label="Featured anime"
          aria-roledescription="carousel"
          onPointerDownCapture={() => setFocusPaused(false)}
          onFocusCapture={(event) =>
            setFocusPaused(
              (event.target as HTMLElement).matches(":focus-visible"),
            )
          }
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setFocusPaused(false);
          }}
        >
          <HeroBackdrop key={anime.id} anime={anime} />
          <div className="hero-shade" />
          <div className="hero-copy" key={"copy-" + anime.id}>
            <h1
              className={
                !titleLogo || validatedLogo !== titleLogo
                  ? getDisplayTitle(anime).length > 60
                    ? "hero-long-title"
                    : undefined
                  : undefined
              }
            >
              <button
                className="hero-title-link"
                aria-label={"View anime details: " + getDisplayTitle(anime)}
                onClick={() => onSelect(anime)}
              >
                {(!titleLogo || validatedLogo !== titleLogo) &&
                  getDisplayTitle(anime)}
                {titleLogo && (
                  <img
                    className="hero-logo"
                    key={titleLogo}
                    src={titleLogo}
                    alt={getDisplayTitle(anime)}
                    style={{
                      display: validatedLogo === titleLogo ? "block" : "none",
                    }}
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      if (
                        isTitleTreatment(
                          image.naturalWidth,
                          image.naturalHeight,
                        )
                      )
                        setValidatedLogo(titleLogo);
                      else setLogoIndex((index) => index + 1);
                    }}
                    onError={() => {
                      setLogoIndex((index) => index + 1);
                    }}
                  />
                )}
              </button>
            </h1>
            <div
              className="hero-actions"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <button
                className="hero-primary"
                onClick={() => {
                  if (resume) onResume(resume);
                  else onWatch(anime);
                }}
              >
                <Play size={19} fill="currentColor" />
                {resume ? "Resume · Ep " + resume.episode : "Watch Now"}
              </button>
              <QuickList
                key={anime.id}
                anime={anime}
                accounts={accounts}
                planning
              />
            </div>
          </div>
          <div
            className="hero-dots glass"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            role="group"
            aria-label="Featured anime slides"
          >
            {slides.map((item, index) => (
              <button
                key={item.id}
                aria-label={"Show " + getDisplayTitle(item)}
                aria-pressed={slide === index}
                onClick={() => {
                  setSlide(index);
                }}
              >
                <span />
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="home-content">
        <section
          className="discovery-section continue-section"
          aria-label="Continue Watching"
        >
          <div className="section-heading">
            <h2>
              <span className="continue-heading-icon">
                <History size={17} />
              </span>
              Continue Watching
            </h2>
          </div>
          {history.length ? (
            <div className="continue-track">
              {history.map((item) => {
                const percent = playbackPercent(item);
                const metadata =
                  episodeMetadata[`${item.anime.id}:${item.episode}`];
                return (
                  <article className="continue-card" key={item.anime.id}>
                    <div className="continue-open">
                      <button
                        className="continue-resume"
                        onClick={() => onResume(item)}
                        aria-label={
                          "Resume " +
                          getDisplayTitle(item.anime) +
                          " episode " +
                          item.episode
                        }
                      >
                        <div className="continue-art">
                          <img
                            loading="lazy"
                            src={
                              metadata?.image ||
                              item.anime.bannerImage ||
                              item.anime.coverImage?.extraLarge
                            }
                            alt=""
                            onError={(event) => {
                              const fallback =
                                item.anime.bannerImage ||
                                item.anime.coverImage?.extraLarge;
                              if (
                                fallback &&
                                event.currentTarget.getAttribute("src") !==
                                  fallback
                              )
                                event.currentTarget.src = fallback;
                            }}
                          />
                          <span className="resume-circle">
                            <Play size={22} fill="currentColor" />
                          </span>
                        </div>
                        {percent !== null ? (
                          <div
                            className="watch-progress"
                            role="progressbar"
                            aria-label={
                              "Episode progress: " + getDisplayTitle(item.anime)
                            }
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                          >
                            <span
                              style={{
                                width: percent + "%",
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="watch-progress unknown"
                            title="Playback progress is not available yet"
                          />
                        )}
                      </button>
                      <div className="continue-info">
                        <h3 title={getDisplayTitle(item.anime)}>
                          <button
                            className="continue-title-link"
                            onClick={() => onSelect(item.anime)}
                            aria-label={
                              "View anime details: " +
                              getDisplayTitle(item.anime)
                            }
                          >
                            {getDisplayTitle(item.anime)}
                          </button>
                        </h3>
                        <span className="episode-badge">EP {item.episode}</span>
                      </div>
                      {metadata?.title && (
                        <p
                          className="continue-episode-title"
                          title={metadata.title}
                        >
                          {metadata.title}
                        </p>
                      )}
                    </div>
                    <button
                      className="remove-history"
                      aria-label={
                        "Remove " +
                        getDisplayTitle(item.anime) +
                        " from Continue Watching"
                      }
                      onClick={() => onRemove(item.anime.id)}
                    >
                      <X size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="continue-empty glass">
              <Play size={22} />
              <div>
                <h3>Your next chapter starts here</h3>
                <p>Start an episode and pick up where you left off.</p>
              </div>
              <button
                onClick={() =>
                  document
                    .querySelector("#discover-anime")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explore anime <ChevronRight size={15} />
              </button>
            </div>
          )}
        </section>
        <LatestEpisodes
          language={language}
          setLanguage={(value) => {
            setLanguage(value);
            try {
              localStorage.setItem("apex_episode_language", value);
            } catch {}
          }}
          onSelect={onSelect}
          onCalendar={onCalendar}
        />
        <div id="discover-anime">
          {rows.map((row) => (
            <PosterRow
              key={row.title}
              {...row}
              accounts={accounts}
              onSelect={onSelect}
            />
          ))}
          <MissingLibraryRow
            accounts={accounts}
            onSelect={onSelect}
            onConnect={onConnect}
          />
        </div>
        <footer className="apex-footer">
          <a href="#" aria-label="Back to top">
            APEX<span>ANIMEHUB</span>
          </a>
          <p>A world of stories. Your next obsession.</p>
          <small>
            Anime data from AniList · Dub timetable from AsunaTracks
          </small>
          <small>
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </small>
        </footer>
      </div>
    </div>
  );
}
