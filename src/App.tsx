import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";
import {
  HomeDashboard,
  FloatingNavigation,
  WatchEntry,
} from "./components/HomeDashboard";
import { fetchAnilist } from "./utils/anilist";
import { aniPmUrl } from "./utils/anipm";
import { getDisplayTitle } from "./utils/schedule";
import { DubScheduleView } from "./components/DubScheduleView";

import { useAccounts } from "./hooks/useAccounts";
import { AccountSettings } from "./components/AccountSettings";
import { AnimeDetails, nextDetailEpisode } from "./components/AnimeDetails";
import { sameAnime } from "./hooks/useLibrary";
import { VideoPlayer } from "./components/VideoPlayer";
import { MyList } from "./components/MyList";

import { DiscoveryPage } from "./components/DiscoveryPage";
import {
  animePage,
  episodePage,
  sectionPaths,
  usePageRoute,
  PlaybackSource,
  AudioLanguage,
} from "./hooks/usePageRoute";
import { detailQuery } from "./utils/detailQuery";
import { fetchHomeCatalog, HomeRow } from "./utils/homeRows";

const THEME_COLOR = "8B5CF6";

export default function App() {
  const accounts = useAccounts();
  const [showAccounts, setShowAccounts] = useState(false);
  const { route, navigate, back } = usePageRoute();
  const view = route.view;
  const [loading, setLoading] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [heroSlides, setHeroSlides] = useState<any[]>([]);

  const [rows, setRows] = useState<HomeRow[]>([]);

  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const activeEpisode = route.episode || 1;
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailAttempt, setDetailAttempt] = useState(0);
  const previousPage = useRef<string>();
  const detailCache = useRef(new Map<number, any>());
  const seeds = useRef(new Map<number, any>());
  const invalidEpisode = !!(
    route.play &&
    selectedAnime?.id === route.animeId &&
    selectedAnime.episodes &&
    activeEpisode > selectedAnime.episodes
  );
  const streamName =
    route.source === "anipm"
      ? `Ani.pm (${route.audio === "dub" ? "Dub" : "Sub"})`
      : route.source === "apex"
        ? "Apex Player (Sub)"
        : `MegaPlay (${route.audio === "dub" ? "Dub" : "Sub"})`;
  const playingStream =
    route.play &&
    !detailLoading &&
    !detailError &&
    !invalidEpisode &&
    selectedAnime?.id === route.animeId
      ? {
          name: streamName,
          url:
            route.source === "anipm"
              ? aniPmUrl(route.animeId!, activeEpisode, route.audio)
              : route.source === "apex"
                ? `/api/playback?id=${route.animeId}&episode=${activeEpisode}`
                : `https://megaplay.buzz/stream/ani/${route.animeId}/${activeEpisode}/${route.audio}?color=${THEME_COLOR}`,
          isEmbed: route.source !== "apex",
        }
      : null;

  const [watchHistory, setWatchHistory] = useState<WatchEntry[]>([]);
  const markWatched = (automatic: boolean, episode = activeEpisode) => {
    if (!selectedAnime) return Promise.resolve([]);
    const completed =
      !!selectedAnime.episodes && episode >= selectedAnime.episodes;
    return accounts.sync(
      selectedAnime,
      completed ? "completed" : "watching",
      episode,
      automatic,
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("oauth")) {
      setShowAccounts(true);
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    }
  }, []);

  useEffect(() => {
    const key = `${route.view}:${route.animeId}:${route.episode}:${route.play}`;
    if (previousPage.current !== undefined && previousPage.current !== key)
      setShowAccounts(false);
    previousPage.current = key;
    setIsSearchExpanded(false);
    setNavHidden(false);
  }, [route.view, route.animeId, route.episode, route.play]);

  useEffect(() => {
    if (route.view !== "details" || !route.animeId) return;
    const id = route.animeId;
    const abort = new AbortController();
    setDetailError("");
    const saved = detailCache.current.get(id);
    if (saved) {
      setSelectedAnime(saved);
      setDetailLoading(false);
      return;
    }
    setSelectedAnime(seeds.current.get(id) || null);
    setDetailLoading(true);
    void fetchAnilist<{ Media: any }>(detailQuery, { id }, abort.signal)
      .then((data) => {
        if (abort.signal.aborted) return;
        if (!data.Media?.id) throw new Error("This anime could not be found.");
        if (detailCache.current.size >= 30)
          detailCache.current.delete(
            detailCache.current.keys().next().value as number,
          );
        detailCache.current.set(id, data.Media);
        setSelectedAnime(data.Media);
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setDetailError(
            error instanceof Error
              ? error.message
              : "Could not load this anime.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setDetailLoading(false);
      });
    return () => abort.abort();
  }, [route.view, route.animeId, detailAttempt]);

  useEffect(() => {
    const section = {
      all: "Home",
      discover: "Discover",
      "my-list": "My List",
      "dub-releases": "Dub Calendar",
      "not-found": "Page not found",
    };
    const page =
      view === "details"
        ? `${selectedAnime?.id === route.animeId ? getDisplayTitle(selectedAnime) : "Anime"}${route.play ? ` · Episode ${activeEpisode}` : ""}`
        : section[view];
    document.title = `${page} | ApexAnimehub`;
  }, [view, route.animeId, route.play, activeEpisode, selectedAnime]);

  // --- DATA FETCHING ---
  const loadContent = useCallback(async () => {
    setLoading(true);
    setContentError(null);
    try {
      const data = await fetchHomeCatalog();
      // AniList has no transparent title-logo field. Allow an optional local art
      // catalog keyed by AniList ID, with readable text when an asset is missing.
      let logos: Record<string, string> = {};
      try {
        const response = await fetch("/anime-logos.json");
        if (response.ok) logos = await response.json();
      } catch {}
      setHeroSlides(
        data.trending.slice(0, 10).map((anime) => ({
          ...anime,
          logoImage:
            typeof logos?.[anime.id] === "string" ? logos[anime.id] : undefined,
        })),
      );
      setRows(data.rows);
    } catch (error) {
      setContentError(
        error instanceof Error ? error.message : "Could not load anime",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
    const savedHistory = localStorage.getItem("videasy_history");
    if (savedHistory) {
      try {
        const saved = JSON.parse(savedHistory);
        if (Array.isArray(saved))
          setWatchHistory(
            saved.filter((item) => item?.anime?.id && item.episode > 0),
          );
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, [loadContent]);

  useEffect(() => {
    let previous = window.scrollY;
    const scroll = () => {
      const current = window.scrollY;
      if (Math.abs(current - previous) > 8) {
        setNavHidden(current > previous && current > 120);
        previous = current;
      }
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setNavHidden(false);
  }, [view]);
  useEffect(() => {
    if (!isSearchExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchExpanded(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [isSearchExpanded]);

  // --- SEARCH ---
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchLoading(false);
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    const delay = setTimeout(async () => {
      try {
        const q = `query ($search: String) { Page(page: 1, perPage: 10) { media(search: $search, type: ANIME) { id idMal title { english romaji } coverImage { extraLarge } episodes nextAiringEpisode { episode } } } }`;
        const data = await fetchAnilist<{ Page: { media: any[] } }>(
          q,
          { search: searchQuery },
          controller.signal,
        );
        if (!controller.signal.aborted) setSearchResults(data.Page.media);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          setSearchError(
            error instanceof Error ? error.message : "Search failed",
          );
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(delay);
      controller.abort();
    };
  }, [searchQuery]);

  // --- WATCH HISTORY MGMT ---
  const updateHistory = (anime: any, ep: number, streamName: string) => {
    setWatchHistory((prev) => {
      const filtered = prev.filter((h) => h.anime.id !== anime.id);
      const newHistory = [
        {
          ...(prev.find(
            (item) => item.anime.id === anime.id && item.episode === ep,
          ) || {}),
          anime,
          episode: ep,
          streamName,
          timestamp: Date.now(),
        },
        ...filtered,
      ].slice(0, 15);
      localStorage.setItem("videasy_history", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const removeFromHistory = (animeId: number) => {
    setWatchHistory((prev) => {
      const newHistory = prev.filter((h) => h.anime.id !== animeId);
      localStorage.setItem("videasy_history", JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const resumePlayback = (historyItem: any) => {
    onSelectMedia(
      historyItem.anime,
      historyItem.episode,
      historyItem.streamName,
    );
  };

  const onSelectMedia = async (
    anime: any,
    startEpisode: number = 1,
    startStream: string | null = null,
  ) => {
    const releaseEpisode = anime?.releaseEpisode;
    if (releaseEpisode) startEpisode = releaseEpisode;
    if (!anime?.id && anime?.idMal) {
      try {
        const result = await fetchAnilist<{ Media: any }>(
          "query($idMal:Int){Media(idMal:$idMal,type:ANIME){id idMal title{english romaji} coverImage{extraLarge} episodes}}",
          { idMal: anime.idMal },
        );
        anime = result.Media;
      } catch {
        setContentError(
          "Could not match this dub release to its anime details.",
        );
        return;
      }
    }
    if (!anime?.id) {
      setContentError(
        "No confirmed anime details are available for this release.",
      );
      return;
    }
    if (!startStream && startEpisode === 1 && !releaseEpisode) {
      const progress = Math.max(
        0,
        ...accounts.libraryEntries
          .filter((entry) => sameAnime(entry.anime, anime))
          .map((entry) => entry.progress),
      );
      const history = watchHistory.find((entry) =>
        sameAnime(entry.anime, anime),
      );
      startEpisode = nextDetailEpisode(
        anime.episodes || Math.max(progress + 1, history?.episode || 1),
        progress,
        history,
        !!anime.episodes,
      );
    }
    seeds.current.set(anime.id, anime);
    if (seeds.current.size > 30)
      seeds.current.delete(seeds.current.keys().next().value as number);
    if (startStream) {
      const source: PlaybackSource = startStream.startsWith("Ani.pm")
        ? "anipm"
        : startStream === "Apex Player (Sub)"
          ? "apex"
          : "megaplay";
      navigate(
        episodePage(
          anime.id,
          startEpisode,
          startStream.includes("Dub") ? "dub" : "sub",
          source,
        ),
      );
    } else
      navigate(
        releaseEpisode
          ? `/anime/${anime.id}?episode=${startEpisode}`
          : animePage(anime.id, startEpisode),
      );
  };

  const playEpisode = (
    episode: number,
    audio: AudioLanguage,
    source: PlaybackSource = "anipm",
  ) => {
    if (!selectedAnime || selectedAnime.id !== route.animeId) return;
    navigate(
      episodePage(
        selectedAnime.id,
        episode,
        audio,
        source === "apex" && audio === "dub" ? "megaplay" : source,
      ),
    );
  };
  const changeEpisode = (direction: "next" | "prev") => {
    const episode = activeEpisode + (direction === "next" ? 1 : -1);
    if (episode < 1 || (direction === "next" && !canNextEpisode)) return;
    playEpisode(episode, route.audio, route.source);
  };

  const totalEpisodes = selectedAnime?.episodes
    ? selectedAnime.episodes
    : selectedAnime?.nextAiringEpisode?.episode
      ? selectedAnime.nextAiringEpisode.episode - 1
      : 1;

  const availableEpisodes = selectedAnime?.nextAiringEpisode?.episode
    ? selectedAnime.nextAiringEpisode.episode - 1
    : selectedAnime?.episodes;
  const canNextEpisode =
    availableEpisodes == null || activeEpisode < availableEpisodes;

  const recordProgress = (
    position: number,
    duration: number,
    episode = activeEpisode,
  ) => {
    if (!selectedAnime || !playingStream) return;
    setWatchHistory((previous) => {
      const next = previous.map((item) =>
        item.anime.id === selectedAnime.id && item.episode === episode
          ? { ...item, position, duration }
          : item,
      );
      try {
        localStorage.setItem("videasy_history", JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  useEffect(() => {
    if (
      !route.play ||
      detailLoading ||
      detailError ||
      invalidEpisode ||
      selectedAnime?.id !== route.animeId
    )
      return;
    updateHistory(selectedAnime, activeEpisode, streamName);
  }, [
    route.play,
    route.animeId,
    activeEpisode,
    streamName,
    detailLoading,
    detailError,
    invalidEpisode,
    selectedAnime?.id,
  ]);

  return (
    <div className="apex-shell">
      <FloatingNavigation
        accounts={accounts}
        notificationFeed={accounts.notificationFeed}
        view={view}
        hidden={navHidden}
        onView={(next) => {
          navigate(sectionPaths[next] || "/");
          window.scrollTo({ top: 0 });
          setNavHidden(false);
        }}
        onSearch={() => setIsSearchExpanded(true)}
        onSettings={() => setShowAccounts(true)}
      />
      {showAccounts && (
        <AccountSettings
          accounts={accounts}
          onClose={() => setShowAccounts(false)}
        />
      )}
      {playingStream && (
        <VideoPlayer
          title={getDisplayTitle(selectedAnime)}
          episode={activeEpisode}
          stream={playingStream}
          canNext={canNextEpisode}
          onPrevious={() => changeEpisode("prev")}
          onNext={() => changeEpisode("next")}
          onWatched={(episode) => void markWatched(true, episode)}
          onEpisodeChange={(episode, lang) => {
            if (episode === activeEpisode && lang === route.audio) return;
            if (
              selectedAnime?.id !== route.animeId ||
              !Number.isSafeInteger(episode) ||
              episode < 1
            )
              return;
            navigate(episodePage(selectedAnime.id, episode, lang, "anipm"));
          }}
          onClose={() => navigate(animePage(selectedAnime.id, activeEpisode))}
          resume={watchHistory.find(
            (item) =>
              item.anime.id === selectedAnime.id &&
              item.episode === activeEpisode,
          )}
          onProgress={recordProgress}
          accounts={accounts}
        />
      )}

      {(contentError || searchError) && (
        <div
          role="alert"
          className="fixed top-4 z-[400] bg-slate-900 text-white p-4 rounded-xl"
        >
          {contentError || searchError}{" "}
          {contentError && (
            <button className="text-purple-400 underline" onClick={loadContent}>
              Retry
            </button>
          )}
        </div>
      )}
      {isSearchExpanded && (
        <div
          className="search-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Search anime"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                "input, button:not(:disabled), a[href]",
              ),
            );
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget)
              setIsSearchExpanded(false);
          }}
        >
          <div className="search-panel glass">
            <div className="search-field">
              <Search size={24} />
              <input
                autoFocus
                aria-label="Search anime titles"
                placeholder="Find your next obsession…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button
                aria-label="Close search"
                onClick={() => {
                  setIsSearchExpanded(false);
                  setSearchQuery("");
                }}
              >
                <X size={23} />
              </button>
            </div>
            <div className="search-results">
              {searchResults.map((result) => (
                <button
                  className="search-result"
                  key={result.id}
                  onClick={() => {
                    onSelectMedia(result);
                    setIsSearchExpanded(false);
                    setSearchQuery("");
                  }}
                >
                  <img src={result.coverImage?.extraLarge} alt="" />
                  <span>{getDisplayTitle(result)}</span>
                </button>
              ))}
            </div>
            {!searchResults.length && (
              <p className="search-help" role="status">
                {searchError ||
                  (searchQuery.length < 3
                    ? "Type at least 3 characters to search anime."
                    : searchLoading
                      ? "Searching anime…"
                      : "No matches. Try another title.")}
              </p>
            )}
          </div>
        </div>
      )}
      <main className="apex-main">
        <div
          className={
            "apex-scroll " +
            (view !== "all" && view !== "details" ? "apex-other-view" : "")
          }
        >
          {/* DUB RELEASES VIEW */}
          {view === "not-found" && (
            <section className="row-loading">
              <h1>Page not found</h1>
              <p>This link does not match a page on ApexAnimehub.</p>
              <a
                href="/"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/");
                }}
              >
                Go Home
              </a>
            </section>
          )}
          {view === "details" &&
            detailLoading &&
            selectedAnime?.id !== route.animeId && (
              <p
                className="row-loading"
                style={{ paddingTop: 130 }}
                role="status"
              >
                Loading anime details…
              </p>
            )}
          {view === "details" && detailError && (
            <section
              className="row-loading"
              style={{ paddingTop: 130 }}
              role="alert"
            >
              <h1>Could not open this anime</h1>
              <p>{detailError}</p>
              <button onClick={() => setDetailAttempt((value) => value + 1)}>
                Try again
              </button>
              <button onClick={() => back()}>Back</button>
            </section>
          )}
          {invalidEpisode && (
            <p role="alert" className="row-loading">
              This episode is outside this anime’s episode count.{" "}
              <button onClick={() => navigate(animePage(selectedAnime.id))}>
                Open anime details
              </button>
            </p>
          )}
          {view === "dub-releases" && (
            <DubScheduleView onSelectMedia={onSelectMedia} />
          )}

          {view === "my-list" && (
            <MyList
              accounts={accounts}
              onSelect={onSelectMedia}
              onConnect={() => setShowAccounts(true)}
            />
          )}
          {view === "discover" && (
            <DiscoveryPage accounts={accounts} onSelect={onSelectMedia} />
          )}
          {view === "details" &&
            selectedAnime?.id === route.animeId &&
            !detailError && (
              <AnimeDetails
                key={selectedAnime.id}
                anime={selectedAnime}
                accounts={accounts}
                total={totalEpisodes}
                selected={activeEpisode}
                history={watchHistory.find(
                  (entry) => entry.anime.id === selectedAnime.id,
                )}
                onBack={() => back()}
                onSelect={onSelectMedia}
                onConnect={() => setShowAccounts(true)}
                onEpisode={(episode) =>
                  navigate(animePage(selectedAnime.id, episode))
                }
                onPlay={playEpisode}
              />
            )}
          {view === "all" && (
            <>
              {loading && (
                <div
                  className="row-loading"
                  style={{ paddingTop: 130 }}
                  role="status"
                >
                  Loading your next obsession…
                </div>
              )}
              {!loading && !heroSlides.length && (
                <div className="row-loading" style={{ paddingTop: 130 }}>
                  Anime discovery is unavailable. Please retry loading.
                </div>
              )}
              <HomeDashboard
                slides={heroSlides}
                rows={rows}
                history={watchHistory}
                accounts={accounts}
                onSelect={onSelectMedia}
                onWatch={(anime) => onSelectMedia(anime, 1, "MegaPlay (Sub)")}
                onResume={resumePlayback}
                onRemove={removeFromHistory}
                onCalendar={() => navigate("/calendar")}
                onConnect={() => setShowAccounts(true)}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
