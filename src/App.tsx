import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Home,
  Ghost,
  Settings,
  Play,
  LayoutGrid,
  Maximize,
  Minimize,
  X,
  SkipBack,
  SkipForward,
  Loader2,
  ChevronLeft,
  Star,
  Clock,
  History,
  MonitorPlay,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Mic, // <-- Added Mic icon
} from "lucide-react";

// --- CONFIG ---
const ANILIST_URL = "https://graphql.anilist.co";
const THEME_COLOR = "8B5CF6"; // Videasy Purple

// --- HELPERS ---
const getDisplayTitle = (item: any) => {
  if (!item) return "Untitled";
  if (item.title) return item.title.english || item.title.romaji || "Untitled";
  return "Untitled";
};

const getShortTitle = (item: any) => {
  const title = getDisplayTitle(item);
  const words = title.trim().split(/\s+/);
  if (words.length > 6) {
    return words.slice(0, 6).join(" ") + "...";
  }
  return title;
};

const fetchAnilist = async (query: string, variables: any = {}) => {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return json.data;
};

const AnimeRow = ({ title, animes, onSelect }: any) => {
  if (!animes || animes.length === 0) return null;
  return (
    <div className="mb-16 animate-fade-in px-12">
      <h2 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.7em] mb-8 flex items-center gap-4">
        <div className="w-12 h-[1px] bg-purple-500/40"></div> {title}
      </h2>
      <div className="flex gap-8 overflow-x-auto no-scrollbar pb-6 px-2 scroll-smooth">
        {animes.map((a: any, idx: number) => (
          <div
            key={a.id || idx}
            onClick={() => onSelect(a)}
            className="min-w-[220px] cursor-pointer group"
          >
            <div className="aspect-[2/3] rounded-[48px] overflow-hidden border border-white/5 group-hover:border-purple-500/50 transition-all duration-700 shadow-2xl bg-zinc-900 relative">
              <img
                src={a.coverImage?.extraLarge}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                alt={getDisplayTitle(a)}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-950/80 via-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[1px]">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                  <Play fill="black" size={28} className="ml-1" />
                </div>
              </div>
            </div>
            <p className="mt-6 text-[12px] font-black truncate text-zinc-400 group-hover:text-white uppercase italic tracking-tighter transition-colors">
              {getDisplayTitle(a)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState("all"); // 'all' | 'details' | 'dub-tracker'
  const [loading, setLoading] = useState(true);
  const [isFullscreenApp, setIsFullscreenApp] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [rows, setRows] = useState<any[]>([]);

  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [availableStreams, setAvailableStreams] = useState<any[]>([]);
  const [playingStream, setPlayingStream] = useState<any>(null);

  const [watchHistory, setWatchHistory] = useState<any[]>([]);

  // --- DATA FETCHING ---
  const loadContent = useCallback(async () => {
    setLoading(true);
    const query = `query { 
      trending: Page(page: 1, perPage: 10) { media(type: ANIME, sort: TRENDING_DESC) { id title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore nextAiringEpisode { episode } } }
      action: Page(page: 1, perPage: 20) { media(type: ANIME, genre: "Action", sort: POPULARITY_DESC) { id title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore nextAiringEpisode { episode } } }
      romance: Page(page: 1, perPage: 20) { media(type: ANIME, genre: "Romance", sort: POPULARITY_DESC) { id title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore nextAiringEpisode { episode } } }
    }`;
    const data = await fetchAnilist(query);
    setHeroSlides(data.trending.media);
    setRows([
      { title: "Trending Now", animes: data.trending.media },
      { title: "Action Picks", animes: data.action.media },
      { title: "Romance Hits", animes: data.romance.media },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContent();
    const savedHistory = localStorage.getItem("videasy_history");
    if (savedHistory) {
      try {
        setWatchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, [loadContent]);

  // --- AUTO SLIDESHOW ---
  useEffect(() => {
    if (heroSlides.length === 0 || view !== "all") return;
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(slideTimer);
  }, [heroSlides.length, view]);

  // --- SEARCH ---
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      const q = `query ($search: String) { Page(page: 1, perPage: 10) { media(search: $search, type: ANIME) { id title { english romaji } coverImage { extraLarge } episodes nextAiringEpisode { episode } } } }`;
      const data = await fetchAnilist(q, { search: searchQuery });
      setSearchResults(data.Page.media);
    }, 400);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // --- WATCH HISTORY MGMT ---
  const updateHistory = (anime: any, ep: number, streamName: string) => {
    setWatchHistory((prev) => {
      const filtered = prev.filter((h) => h.anime.id !== anime.id);
      const newHistory = [
        { anime, episode: ep, streamName, timestamp: Date.now() },
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
      historyItem.streamName
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
    startEpisode = 1,
    startStream: string | null = null
  ) => {
    setSelectedAnime(anime);
    setView("details");
    setActiveEpisode(startEpisode);
    const resolved = resolveStreams(anime, startEpisode);

    if (startStream) {
      const isDub = startStream.includes("Dub");
      setPlayingStream({
        name: startStream,
        url: `https://megaplay.buzz/stream/ani/${anime.id}/${startEpisode}/${
          isDub ? "dub" : "sub"
        }?color=${THEME_COLOR}`,
        isEmbed: true,
      });
    }

    try {
      const query = `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore 
          nextAiringEpisode { episode }
          relations {
            edges {
              relationType
              node { id title { english romaji } coverImage { extraLarge } type bannerImage description episodes averageScore nextAiringEpisode { episode } }
            }
          }
        }
      }`;
      const fullData = await fetchAnilist(query, { id: anime.id });
      setSelectedAnime(fullData.Media);
    } catch (e) {
      console.error("Failed to fetch relations", e);
    }
  };

  const changeEpisode = (direction: "next" | "prev") => {
    const newEp = direction === "next" ? activeEpisode + 1 : activeEpisode - 1;
    setActiveEpisode(newEp);
    resolveStreams(selectedAnime, newEp);

    const isDub = playingStream?.name.includes("Dub");
    const streamName = isDub ? "MegaPlay (Dub)" : "MegaPlay (Sub)";
    setPlayingStream({
      name: streamName,
      url: `https://megaplay.buzz/stream/ani/${selectedAnime.id}/${newEp}/${
        isDub ? "dub" : "sub"
      }?color=${THEME_COLOR}`,
      isEmbed: true,
    });
    updateHistory(selectedAnime, newEp, streamName);
  };

  const totalEpisodes = selectedAnime?.episodes
    ? selectedAnime.episodes
    : selectedAnime?.nextAiringEpisode?.episode
    ? selectedAnime.nextAiringEpisode.episode - 1
    : 1;

  return (
    <div
      className={`bg-[#050505] text-white selection:bg-purple-500 overflow-hidden transition-all duration-700 ${
        isFullscreenApp
          ? "fixed inset-0"
          : "min-h-screen p-4 flex items-center justify-center"
      }`}
    >
      {/* 🚀 SIDEBAR */}
      <div className="fixed left-0 top-0 w-[5px] h-full z-[450] group/trigger">
        <div
          className={`fixed z-[400] top-1/2 -translate-y-1/2 w-20 h-[650px] bg-white/5 backdrop-blur-3xl border border-white/10 rounded-full flex flex-col items-center py-12 space-y-10 shadow-2xl transition-all duration-500 ${
            isFullscreenApp
              ? "-left-24 group-hover/trigger:left-4 opacity-0 group-hover/trigger:opacity-100"
              : "left-6 opacity-100 hover:bg-white/10"
          }`}
        >
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center animate-pulse">
            <LayoutGrid size={22} />
          </div>
          <Home
            onClick={() => {
              setView("all");
              setPlayingStream(null);
            }}
            className={`cursor-pointer transition-all ${
              view === "all"
                ? "text-purple-500 scale-150"
                : "text-zinc-500 hover:text-white"
            }`}
          />
          {/* DUB TRACKER ICON */}
          <Mic
            onClick={() => {
              setView("dub-tracker");
              setPlayingStream(null);
            }}
            className={`cursor-pointer transition-all ${
              view === "dub-tracker"
                ? "text-purple-500 scale-150"
                : "text-zinc-500 hover:text-white"
            }`}
          />
          <div className="flex-grow" />
          <button
            onClick={() => setIsFullscreenApp(!isFullscreenApp)}
            className="text-zinc-500 hover:text-white"
          >
            {isFullscreenApp ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <Settings className="text-zinc-500 hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* 🎬 PLAYER MODAL */}
      {playingStream && (
        <div className="fixed inset-0 z-[500] bg-black flex flex-col animate-in fade-in">
          {/* Top Bar (Title & Close) */}
          <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start z-[502] pointer-events-none">
            <div className="bg-[#1c1c1c]/90 backdrop-blur-md p-5 px-8 rounded-[16px] border border-white/5 flex flex-col gap-1 shadow-2xl pointer-events-auto">
              <h2 className="text-white font-black text-lg italic uppercase tracking-tighter">
                {getDisplayTitle(selectedAnime)}
              </h2>
              <p className="text-purple-400 font-bold tracking-[0.3em] uppercase text-[10px]">
                Episode {activeEpisode} • {playingStream.name}
              </p>
            </div>
            <button
              onClick={() => setPlayingStream(null)}
              className="p-5 bg-black/60 border border-white/10 hover:bg-red-600 rounded-full transition-all text-white backdrop-blur-md shadow-2xl pointer-events-auto"
            >
              <X size={24} />
            </button>
          </div>

          {/* The Iframe Player */}
          <iframe
            src={playingStream.url}
            className="flex-1 w-full h-full border-none z-[500]"
            allowFullScreen
            allow="autoplay; encrypted-media"
            title="Video Stream Player"
          />

          {/* Bottom Episode Controls */}
          <div className="absolute bottom-10 right-10 z-[502] flex gap-4 pointer-events-none">
            {activeEpisode > 1 && (
              <button
                onClick={() => changeEpisode("prev")}
                className="px-8 py-5 bg-[#1c1c1c]/90 border border-white/5 hover:bg-purple-600 hover:border-purple-400 rounded-[16px] transition-all text-white flex items-center gap-3 backdrop-blur-md shadow-2xl pointer-events-auto"
              >
                <SkipBack size={20} />
                <span className="font-black text-[13px] uppercase tracking-[0.2em] hidden md:block">
                  Prev
                </span>
              </button>
            )}
            {selectedAnime && activeEpisode < totalEpisodes && (
              <button
                onClick={() => changeEpisode("next")}
                className="px-8 py-5 bg-[#1c1c1c]/90 border border-white/5 hover:bg-purple-600 hover:border-purple-400 rounded-[16px] transition-all text-white flex items-center gap-3 backdrop-blur-md shadow-2xl pointer-events-auto"
              >
                <span className="font-black text-[13px] uppercase tracking-[0.2em] hidden md:block">
                  Next
                </span>
                <SkipForward size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div
        className={`bg-[#121212] border border-white/5 shadow-2xl transition-all duration-700 overflow-hidden flex flex-col ${
          isFullscreenApp
            ? "w-full h-full"
            : "w-full max-w-7xl h-[92vh] rounded-[56px]"
        }`}
      >
        {/* 🔍 SEARCH (Only visible on Home screen) */}
        {view === "all" && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[310] pointer-events-none">
            <div
              className={`flex items-center bg-white/5 backdrop-blur-4xl border border-white/10 rounded-[32px] transition-all duration-500 pointer-events-auto shadow-2xl ${
                isSearchExpanded
                  ? "w-[500px] px-6 py-2"
                  : "w-16 h-16 justify-center cursor-pointer"
              }`}
              onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
            >
              <Search className="text-purple-400" size={24} />
              {isSearchExpanded && (
                <>
                  <input
                    autoFocus
                    className="flex-1 bg-transparent px-6 py-4 outline-none text-xs font-black text-white"
                    placeholder="SEARCH ANIME..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <X
                    className="text-zinc-500 cursor-pointer"
                    size={20}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSearchExpanded(false);
                      setSearchQuery("");
                    }}
                  />
                </>
              )}
            </div>
            {searchResults.length > 0 && isSearchExpanded && (
              <div className="absolute bottom-24 left-0 w-full bg-[#0a0a0a]/95 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl pointer-events-auto max-h-[400px] overflow-y-auto">
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      onSelectMedia(r);
                      setIsSearchExpanded(false);
                      setSearchQuery("");
                    }}
                    className="p-5 flex gap-6 hover:bg-purple-600/20 cursor-pointer border-b border-white/5"
                  >
                    <img
                      src={r.coverImage?.extraLarge}
                      className="w-12 h-18 object-cover rounded-2xl"
                      alt={getDisplayTitle(r)}
                    />
                    <div className="flex flex-col justify-center">
                      <p className="font-black text-[12px] uppercase">
                        {getDisplayTitle(r)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative">
          {/* 🎙️ DUB TRACKER VIEW */}
          {view === "dub-tracker" ? (
            <div className="h-full flex flex-col p-10 animate-fade-in relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-purple-600 rounded-[20px] flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Mic size={28} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                      Dub Tracker
                    </h1>
                    <p className="text-purple-400 font-bold tracking-[0.3em] uppercase text-[10px]">
                      Powered by animedubstatus.com
                    </p>
                  </div>
                </div>
                <a
                  href="https://animedubstatus.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest transition-colors bg-white/5 px-6 py-3 rounded-full hover:bg-white/10 border border-white/5"
                >
                  Open in new tab <ExternalLink size={14} />
                </a>
              </div>

              <div className="flex-1 rounded-[48px] overflow-hidden border border-white/10 shadow-2xl bg-[#080808] relative">
                <iframe
                  src="https://animedubstatus.com/"
                  className="w-full h-full border-none"
                  title="Anime Dub Status Tracker"
                />
              </div>
            </div>
          ) : // 🎬 DETAILS VIEW
          view === "details" && selectedAnime ? (
            <div className="animate-fade-in flex h-full">
              <div className="flex-1 overflow-y-auto no-scrollbar relative pb-40">
                <div className="relative h-[650px] w-full">
                  <img
                    src={
                      selectedAnime.bannerImage ||
                      selectedAnime.coverImage?.extraLarge
                    }
                    className="w-full h-full object-cover"
                    alt={getDisplayTitle(selectedAnime)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent" />
                  <button
                    onClick={() => setView("all")}
                    className="absolute top-10 left-10 p-5 bg-black/50 rounded-full hover:bg-purple-600 transition-all z-20"
                  >
                    <ChevronLeft size={28} />
                  </button>
                </div>
                <div className="px-20 -mt-80 relative z-10 flex flex-col gap-16">
                  <div className="flex gap-14">
                    <div className="w-80 aspect-[2/3] rounded-[64px] overflow-hidden shadow-2xl border border-white/10 bg-zinc-900 shrink-0">
                      <img
                        src={selectedAnime.coverImage?.extraLarge}
                        className="w-full h-full object-cover"
                        alt={getDisplayTitle(selectedAnime)}
                      />
                    </div>
                    <div className="flex-1 pt-32">
                      <div className="flex items-center gap-5 mb-10">
                        <div className="px-7 py-3 bg-white/5 rounded-[20px] flex items-center gap-3 text-yellow-500 font-black">
                          <Star size={20} fill="currentColor" />{" "}
                          {selectedAnime.averageScore / 10 || "N/A"}
                        </div>
                      </div>
                      <h1 className="text-[80px] font-black italic uppercase tracking-tighter leading-[0.75] mb-12">
                        {getDisplayTitle(selectedAnime)}
                      </h1>
                      <p
                        className="text-zinc-400 text-[18px] leading-relaxed max-w-4xl opacity-70"
                        dangerouslySetInnerHTML={{
                          __html: selectedAnime.description,
                        }}
                      />
                    </div>
                  </div>

                  {/* EPISODES GRID */}
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

                  {/* RELATED MEDIA SECTION */}
                  {selectedAnime.relations?.edges?.some(
                    (e: any) => e.node.type === "ANIME"
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
              <div className="w-[450px] bg-[#080808]/90 backdrop-blur-5xl border-l border-white/10 overflow-y-auto no-scrollbar p-12 flex flex-col shrink-0 h-full sticky top-0">
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
          ) : (
            // 🏠 HOME VIEW
            <>
              {/* HERO */}
              {heroSlides?.[currentSlide] && (
                <div className="px-12 mt-10 mb-10">
                  <div className="relative w-full h-[700px] rounded-[72px] overflow-hidden group shadow-2xl border border-white/5 bg-[#0a0a0a]">
                    <div
                      key={currentSlide}
                      className="absolute inset-0 animate-in fade-in duration-1000"
                    >
                      <img
                        src={
                          heroSlides[currentSlide].bannerImage ||
                          heroSlides[currentSlide].coverImage?.extraLarge
                        }
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[20s]"
                        alt={getDisplayTitle(heroSlides[currentSlide])}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 p-20 flex flex-col justify-end">
                        {/* Quantum Spotlight Label */}
                        <div className="flex items-center gap-3 mb-6 animate-in slide-in-from-bottom-5 duration-700">
                          <Sparkles size={16} className="text-purple-400" />
                          <span className="text-purple-400 font-black text-[11px] uppercase tracking-[0.8em]">
                            Quantum Spotlight
                          </span>
                        </div>

                        <h1 className="text-[90px] font-black italic uppercase tracking-tighter leading-[0.7] mb-14 max-w-5xl animate-in slide-in-from-bottom-10 duration-700 drop-shadow-2xl">
                          {getShortTitle(heroSlides[currentSlide])}
                        </h1>

                        {/* Hero Buttons */}
                        <div className="flex gap-6 animate-in slide-in-from-bottom-10 duration-1000">
                          <button
                            onClick={() =>
                              onSelectMedia(heroSlides[currentSlide])
                            }
                            className="px-20 py-6 bg-white text-black rounded-[24px] font-black text-[18px] uppercase tracking-[0.2em] hover:bg-purple-600 hover:text-white transition-colors shadow-2xl flex items-center justify-center"
                          >
                            Watch Now
                          </button>

                          <div className="px-8 py-6 bg-white/10 backdrop-blur-md border border-white/10 rounded-[24px] flex items-center gap-3 shadow-2xl cursor-default">
                            <span className="text-yellow-400 text-3xl leading-none">
                              ★
                            </span>
                            <span className="font-black text-white text-2xl leading-none">
                              {heroSlides[currentSlide].averageScore
                                ? (
                                    heroSlides[currentSlide].averageScore / 10
                                  ).toFixed(1)
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* HERO CONTROLS */}
                    <div className="absolute bottom-16 right-20 flex items-center gap-8 z-20">
                      <div className="flex gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentSlide((prev) =>
                              prev === 0 ? heroSlides.length - 1 : prev - 1
                            );
                          }}
                          className="p-4 rounded-full bg-black/40 text-white hover:bg-purple-600 transition-all backdrop-blur-md"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentSlide(
                              (prev) => (prev + 1) % heroSlides.length
                            );
                          }}
                          className="p-4 rounded-full bg-black/40 text-white hover:bg-purple-600 transition-all backdrop-blur-md rotate-180"
                        >
                          <ChevronLeft size={20} />
                        </button>
                      </div>
                      <div className="flex gap-3">
                        {heroSlides.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={`h-2 rounded-full transition-all duration-500 ${
                              currentSlide === idx
                                ? "w-8 bg-purple-500"
                                : "w-2 bg-white/20 hover:bg-white/40"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTINUE WATCHING */}
              {watchHistory.length > 0 && (
                <div className="mb-16 px-12 animate-fade-in mt-6">
                  <div className="flex items-center gap-5 mb-8">
                    <div className="w-12 h-12 bg-[#2a1b3d] text-[#b794f4] rounded-[18px] flex items-center justify-center shadow-lg">
                      <History size={20} />
                    </div>
                    <h2 className="text-zinc-400 text-[11px] font-black tracking-[0.6em] uppercase">
                      Continue Watching
                    </h2>
                  </div>
                  <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 scroll-smooth">
                    {watchHistory.map((item) => (
                      <div
                        key={item.anime.id}
                        className="relative group shrink-0"
                      >
                        <div
                          onClick={() => resumePlayback(item)}
                          className="w-[400px] bg-[#151515] border border-white/5 rounded-[40px] p-4 flex flex-col gap-4 hover:border-purple-500/50 transition-all duration-500 cursor-pointer shadow-xl"
                        >
                          <div className="relative w-full aspect-video rounded-[32px] overflow-hidden bg-zinc-900 border border-white/5">
                            <img
                              src={
                                item.anime.bannerImage ||
                                item.anime.coverImage?.extraLarge
                              }
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              alt={getDisplayTitle(item.anime)}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromHistory(item.anime.id);
                              }}
                              className="absolute top-4 right-4 w-9 h-9 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 hover:scale-110 shadow-xl"
                            >
                              <X size={16} className="text-white" />
                            </button>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500 border border-white/20">
                                <Play
                                  fill="white"
                                  size={24}
                                  className="ml-1 text-white"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-3 pb-2 gap-4">
                            <p className="font-black text-[13px] uppercase truncate flex-1 text-zinc-200 group-hover:text-white transition-colors">
                              {getDisplayTitle(item.anime)}
                            </p>
                            <div className="bg-[#2a1b3d] text-[#d6bcfa] px-5 py-2 rounded-full text-[10px] font-black shrink-0 tracking-widest uppercase">
                              Ep {item.episode}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ROWS */}
              {rows.map((row, i) => (
                <AnimeRow
                  key={i}
                  title={row.title}
                  animes={row.animes}
                  onSelect={(a: any) => onSelectMedia(a)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
