import React, { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import {
  HomeDashboard,
  FloatingNavigation,
  WatchEntry,
} from "./components/HomeDashboard";
import { fetchAnilist } from "./utils/anilist";
import { getDisplayTitle } from "./utils/schedule";
import { DubScheduleView } from "./components/DubScheduleView";

import { useAccounts } from "./hooks/useAccounts";
import { AccountSettings } from "./components/AccountSettings";
import { AnimeDetails, nextDetailEpisode } from "./components/AnimeDetails";
import { sameAnime } from "./hooks/useLibrary";
import { VideoPlayer } from "./components/VideoPlayer";
import { MyList } from "./components/MyList";

import { DiscoveryPage } from "./components/DiscoveryPage";

const THEME_COLOR = "8B5CF6";

export default function App() {
  const accounts = useAccounts();
  const [showAccounts, setShowAccounts] = useState(false);
  const [view, setView] = useState("all");
  const [loading, setLoading] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [heroSlides, setHeroSlides] = useState<any[]>([]);

  const [rows, setRows] = useState<any[]>([]);

  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [activeEpisode, setActiveEpisode] = useState(1);

  const [playingStream, setPlayingStream] = useState<any>(null);

  const [watchHistory, setWatchHistory] = useState<WatchEntry[]>([]);
  const markWatched = (automatic: boolean) => {
    if (!selectedAnime) return Promise.resolve([]);
    const completed =
      !!selectedAnime.episodes && activeEpisode >= selectedAnime.episodes;
    return accounts.sync(
      selectedAnime,
      completed ? "completed" : "watching",
      activeEpisode,
      automatic,
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("oauth")) {
      setShowAccounts(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // --- DATA FETCHING ---
  const loadContent = useCallback(async () => {
    setLoading(true);
    const query = `query {
      trending: Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore nextAiringEpisode { episode } } }
      action: Page(page: 1, perPage: 20) { media(type: ANIME, genre: "Action", sort: POPULARITY_DESC) { id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore nextAiringEpisode { episode } } }
      romance: Page(page: 1, perPage: 20) { media(type: ANIME, genre: "Romance", sort: POPULARITY_DESC) { id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore nextAiringEpisode { episode } } }
    }`;
    setContentError(null);
    try {
      const data = await fetchAnilist<{
        trending: { media: any[] };
        action: { media: any[] };
        romance: { media: any[] };
      }>(query);
      // AniList has no transparent title-logo field. Allow an optional local art
      // catalog keyed by AniList ID, with readable text when an asset is missing.
      let logos: Record<string, string> = {};
      try {
        const response = await fetch("/anime-logos.json");
        if (response.ok) logos = await response.json();
      } catch {}
      setHeroSlides(
        data.trending.media.map((anime) => ({
          ...anime,
          logoImage:
            typeof logos?.[anime.id] === "string" ? logos[anime.id] : undefined,
        })),
      );
      setRows([
        { title: "Trending Now", animes: data.trending.media },
        { title: "Action Picks", animes: data.action.media },
        { title: "Romance Hits", animes: data.romance.media },
      ]);
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

  // --- STREAM RESOLVER ---
  const resolveStreams = (anime: any, ep: number) => {
    const base = `https://megaplay.buzz/stream/ani/${anime.id}/${ep}`;
    const streams = [
      {
        name: "MegaPlay (Sub)",
        url: `${base}/sub?color=${THEME_COLOR}`,
        isEmbed: true,
      },
      {
        name: "MegaPlay (Dub)",
        url: `${base}/dub?color=${THEME_COLOR}`,
        isEmbed: true,
      },
    ];

    return streams;
  };

  const onSelectMedia = async (
    anime: any,
    startEpisode: number = 1,
    startStream: string | null = null,
  ) => {
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
    if (!startStream) setPlayingStream(null);
    if (!startStream && startEpisode === 1) {
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
    setSelectedAnime(anime);
    setView("details");
    window.scrollTo({ top: 0 });
    setActiveEpisode(startEpisode);
    resolveStreams(anime, startEpisode);

    if (startStream) {
      updateHistory(anime, startEpisode, startStream);
      const isDub = startStream.includes("Dub");
      setPlayingStream({
        name: startStream,
        url:
          startStream === "Apex Player (Sub)"
            ? `/api/playback?id=${anime.id}&episode=${startEpisode}`
            : `https://megaplay.buzz/stream/ani/${anime.id}/${startEpisode}/${isDub ? "dub" : "sub"}?color=${THEME_COLOR}`,
        isEmbed: true,
      });
    }

    try {
      const query = `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore
          seasonYear format status genres studios(isMain:true){nodes{name}} nextAiringEpisode { episode }
          relations {
            edges {
              relationType
              node { id idMal title { english romaji } coverImage { extraLarge } type bannerImage description episodes averageScore nextAiringEpisode { episode } }
            }
          }
        }
      }`;
      const fullData = await fetchAnilist<{ Media: any }>(query, {
        id: anime.id,
      });
      if (!fullData.Media?.id) throw new Error("AniList returned no media");
      setSelectedAnime((current: { id: number } | null) =>
        current?.id === anime.id ? fullData.Media : current,
      );
    } catch (e) {
      console.error("Failed to fetch relations", e);
    }
  };

  const changeEpisode = (direction: "next" | "prev") => {
    const newEp = direction === "next" ? activeEpisode + 1 : activeEpisode - 1;
    if (
      !selectedAnime ||
      newEp < 1 ||
      (direction === "next" && !canNextEpisode)
    )
      return;
    setActiveEpisode(newEp);
    resolveStreams(selectedAnime, newEp);

    const isDub = playingStream?.name?.includes("Dub");
    const streamName =
      playingStream?.name === "Apex Player (Sub)"
        ? "Apex Player (Sub)"
        : isDub
          ? "MegaPlay (Dub)"
          : "MegaPlay (Sub)";
    setPlayingStream({
      name: streamName,
      url:
        streamName === "Apex Player (Sub)"
          ? `/api/playback?id=${selectedAnime.id}&episode=${newEp}`
          : `https://megaplay.buzz/stream/ani/${selectedAnime.id}/${newEp}/${isDub ? "dub" : "sub"}?color=${THEME_COLOR}`,
      isEmbed: true,
    });
    updateHistory(selectedAnime, newEp, streamName);
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

  const recordProgress = (position: number, duration: number) => {
    if (!selectedAnime || !playingStream) return;
    setWatchHistory((previous) => {
      const next = previous.map((item) =>
        item.anime.id === selectedAnime.id && item.episode === activeEpisode
          ? { ...item, position, duration }
          : item,
      );
      try {
        localStorage.setItem("videasy_history", JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  return (
    <div className="apex-shell">
      <FloatingNavigation
        notificationFeed={accounts.notificationFeed}
        view={view}
        hidden={navHidden}
        onView={(next) => {
          setView(next);
          setPlayingStream(null);
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
          onWatched={() => void markWatched(true)}
          onClose={() => setPlayingStream(null)}
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
          {view === "details" && selectedAnime && (
            <AnimeDetails
              key={selectedAnime.id}
              anime={selectedAnime}
              accounts={accounts}
              total={totalEpisodes}
              selected={activeEpisode}
              history={watchHistory.find(
                (entry) => entry.anime.id === selectedAnime.id,
              )}
              onBack={() => setView("all")}
              onSelect={onSelectMedia}
              onConnect={() => setShowAccounts(true)}
              onEpisode={(episode) => {
                setActiveEpisode(episode);
                resolveStreams(selectedAnime, episode);
              }}
              onPlay={(episode, audio, source) => {
                setActiveEpisode(episode);
                if (source === "apex" && audio === "sub") {
                  const stream = {
                    name: "Apex Player (Sub)",
                    url: `/api/playback?id=${selectedAnime.id}&episode=${episode}`,
                    isEmbed: false,
                  };
                  setPlayingStream(stream);
                  updateHistory(selectedAnime, episode, stream.name);
                  return;
                }
                const streams = resolveStreams(selectedAnime, episode);
                const stream = streams.find(
                  (item) =>
                    item.name ===
                    (audio === "dub" ? "MegaPlay (Dub)" : "MegaPlay (Sub)"),
                );
                if (stream) {
                  setPlayingStream(stream);
                  updateHistory(selectedAnime, episode, stream.name);
                }
              }}
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
                onCalendar={() => setView("dub-releases")}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
