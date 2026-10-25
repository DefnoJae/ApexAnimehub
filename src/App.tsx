import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Search, Star, X } from "lucide-react";
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
import { ListControls } from "./components/ListControls";
import { VideoPlayer } from "./components/VideoPlayer";
import { MyList } from "./components/MyList";
import { AnimeBadges } from "./components/AnimeBadges";
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
  const [availableStreams, setAvailableStreams] = useState<any[]>([]);
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
    setAvailableStreams(streams);
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
    setSelectedAnime(anime);
    setView("details");
    setActiveEpisode(startEpisode);
    resolveStreams(anime, startEpisode);

    if (startStream) {
      updateHistory(anime, startEpisode, startStream);
      const isDub = startStream.includes("Dub");
      setPlayingStream({
        name: startStream,
        url: `https://megaplay.buzz/stream/ani/${anime.id}/${startEpisode}/${isDub ? "dub" : "sub"}?color=${THEME_COLOR}`,
        isEmbed: true,
      });
    }

    try {
      const query = `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore
          nextAiringEpisode { episode }
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
    const streamName = isDub ? "MegaPlay (Dub)" : "MegaPlay (Sub)";
    setPlayingStream({
      name: streamName,
      url: `https://megaplay.buzz/stream/ani/${selectedAnime.id}/${newEp}/${isDub ? "dub" : "sub"}?color=${THEME_COLOR}`,
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
          className={"apex-scroll " + (view !== "all" ? "apex-other-view" : "")}
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
          {/* DETAILS VIEW */}
          {view === "details" && selectedAnime && (
            <div className="apex-details animate-fade-in flex h-full">
              <div className="apex-details-main flex-1 overflow-y-auto no-scrollbar relative pb-40">
                <div className="relative h-[650px] w-full">
                  <img
                    src={
                      selectedAnime.bannerImage ||
                      selectedAnime.coverImage?.extraLarge
                    }
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent" />
                  <button
                    onClick={() => setView("all")}
                    className="details-back absolute top-10 left-10 p-5 bg-black/50 rounded-full hover:bg-purple-600 transition-all z-20"
                  >
                    <ChevronLeft size={28} />
                  </button>
                </div>
                <div className="details-info px-20 -mt-80 relative z-10 flex flex-col gap-16">
                  <div className="flex gap-14">
                    <div className="details-poster w-80 aspect-[2/3] rounded-[64px] overflow-hidden shadow-2xl border border-white/10 bg-zinc-900 shrink-0">
                      <img
                        src={selectedAnime.coverImage?.extraLarge}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 pt-32">
                      <div className="flex items-center gap-5 mb-10">
                        <div className="px-7 py-3 bg-white/5 rounded-[20px] flex items-center gap-3 text-yellow-500 font-black">
                          <Star size={20} fill="currentColor" />{" "}
                          {selectedAnime.averageScore / 10 || "N/A"}
                        </div>
                      </div>
                      <h1 className="details-title text-[80px] font-black italic uppercase tracking-tighter leading-[0.75] mb-12">
                        {getDisplayTitle(selectedAnime)}
                      </h1>
                      <p
                        className="details-text text-zinc-400 text-[18px] leading-relaxed max-w-4xl opacity-70"
                        dangerouslySetInnerHTML={{
                          __html: selectedAnime.description,
                        }}
                      />
                    </div>
                  </div>

                  <AnimeBadges idMal={selectedAnime.idMal} />
                  <ListControls
                    key={selectedAnime.id}
                    anime={selectedAnime}
                    accounts={accounts}
                    onConnect={() => setShowAccounts(true)}
                  />
                  <div className="animate-in slide-in-from-bottom-10 duration-700">
                    <p className="text-purple-500 font-black text-[11px] uppercase tracking-[0.6em] mb-8 text-center">
                      Episodes ({totalEpisodes})
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {Array.from({ length: totalEpisodes }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setActiveEpisode(i + 1);
                            resolveStreams(selectedAnime, i + 1);
                          }}
                          className={`w-[60px] h-16 shrink-0 rounded-[20px] font-black text-xs border transition-all ${
                            activeEpisode === i + 1
                              ? "bg-purple-600 border-purple-400 scale-110"
                              : "bg-white/5 border-white/10 opacity-40 hover:opacity-100 hover:bg-white/20"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedAnime.relations?.edges?.some(
                    (e: any) => e.node.type === "ANIME",
                  ) && (
                    <div className="mt-20 animate-fade-in pb-12">
                      <p className="text-purple-500 font-black text-[11px] uppercase tracking-[0.6em] mb-8">
                        Related Media & Sequels
                      </p>
                      <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 scroll-smooth">
                        {selectedAnime.relations.edges
                          .filter((e: any) => e.node.type === "ANIME")
                          .map((edge: any) => {
                            const rel = edge.node;
                            return (
                              <div
                                key={rel.id}
                                onClick={() => onSelectMedia(rel)}
                                className="w-[180px] shrink-0 cursor-pointer group"
                              >
                                <div className="aspect-[2/3] rounded-[32px] overflow-hidden shadow-2xl border border-white/5 bg-zinc-900 relative">
                                  <img
                                    src={rel.coverImage?.extraLarge}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                    alt={getDisplayTitle(rel)}
                                  />
                                  <div className="absolute top-4 left-4 bg-purple-600/90 backdrop-blur-sm text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-widest shadow-lg">
                                    {edge.relationType.replace(/_/g, " ")}
                                  </div>
                                </div>
                                <p className="mt-5 text-[12px] font-black truncate text-zinc-400 group-hover:text-white uppercase italic tracking-tighter transition-colors px-2">
                                  {getDisplayTitle(rel)}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="apex-details-sources w-[450px] bg-[#080808]/90 backdrop-blur-5xl border-l border-white/10 overflow-y-auto no-scrollbar p-12 flex flex-col shrink-0 h-full sticky top-0">
                <h3 className="text-[11px] font-black uppercase tracking-[0.6em] text-purple-500 mb-10 sticky top-0 bg-[#080808] py-4 z-10">
                  Sources
                </h3>
                <div className="space-y-5">
                  {availableStreams.map((s, i) => (
                    <div
                      key={i}
                      className="bg-white/5 border border-white/10 p-7 rounded-[40px] hover:border-purple-500/40 transition-all flex flex-col gap-6"
                    >
                      <p className="font-black text-[12px] uppercase">
                        {s.name}
                      </p>
                      <button
                        onClick={() => {
                          setPlayingStream(s);
                          updateHistory(selectedAnime, activeEpisode, s.name);
                        }}
                        className="w-full bg-white text-black font-black text-[11px] py-4 rounded-[20px] uppercase hover:bg-purple-600 hover:text-white transition-all"
                      >
                        Play Episode {activeEpisode}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
