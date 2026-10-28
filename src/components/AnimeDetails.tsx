import React, { lazy, Suspense, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ListOrdered,
  Play,
  Star,
} from "lucide-react";
import type { DashboardAnime, WatchEntry } from "./HomeDashboard";
import type { ListStatus, useAccounts } from "../hooks/useAccounts";
import { sameAnime } from "../hooks/useLibrary";
import { getDisplayTitle } from "../utils/schedule";
import { FriendsActivityDock } from "./FriendsActivityDock";
import { TrailerButton } from "./TrailerButton";
import { DetailTitle } from "./DetailTitle";
import { HeroBackdrop } from "./HeroBackdrop";
import { AnimeBadges } from "./AnimeBadges";
import { DetailEpisodes } from "./DetailEpisodes";
import { QuickList } from "./HomeDashboard";
import { ListEntryEditor } from "./ListEntryEditor";
import "./animeDetails.css";
import "./watchOrder.css";
const WatchOrder = lazy(() => import("./WatchOrder"));
export interface DetailAnime extends DashboardAnime {
  trailer?: { id?: string | null; site?: string | null } | null;
  seasonYear?: number;
  format?: string;
  status?: string;
  genres?: string[];
  recommendations?: {
    nodes: Array<{
      mediaRecommendation?:
        | (DashboardAnime & { type?: string; isAdult?: boolean })
        | null;
    }>;
  };
  studios?: { nodes: Array<{ name: string }> };
  relations?: {
    edges: Array<{
      relationType: string;
      node: DashboardAnime & { type?: string };
    }>;
  };
}
const labels: Record<ListStatus, string> = {
  planning: "Planning",
  watching: "Watching",
  completed: "Completed",
  paused: "On hold",
  dropped: "Dropped",
};
export function descriptionText(html?: string) {
  if (!html) return "";
  const document = new DOMParser().parseFromString(
    html.replace(/<br\s*\/?\s*>/gi, "\n"),
    "text/html",
  );
  document
    .querySelectorAll("script,style")
    .forEach((element) => element.remove());
  return document.body.textContent?.trim() || "";
}
export function nextDetailEpisode(
  total: number,
  progress: number,
  history?: WatchEntry,
  knownTotal = true,
) {
  if (knownTotal && progress >= total) return 1;
  return Math.max(
    1,
    Math.min(total, Math.max(progress + 1, history?.episode || 1)),
  );
}
export function AnimeDetails({
  anime,
  accounts,
  total,
  selected,
  history,
  onEpisode,
  onPlay,
  onBack,
  onSelect,
  onConnect,
}: {
  anime: DetailAnime;
  accounts: ReturnType<typeof useAccounts>;
  total: number;
  selected: number;
  history?: WatchEntry;
  onEpisode: (episode: number) => void;
  onPlay: (
    episode: number,
    audio: "sub" | "dub",
    source?: "apex" | "megaplay" | "anipm",
  ) => void;
  onBack: () => void;
  onSelect: (anime: DashboardAnime) => void;
  onConnect: () => void;
}) {
  const [tab, setTab] = useState<"episodes" | "related" | "recommendations">(
    "episodes",
  );
  const [expanded, setExpanded] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [source, setSource] = useState<"apex" | "megaplay" | "anipm">("anipm");
  const [audio, setAudio] = useState<"sub" | "dub">(() => {
    try {
      return localStorage.getItem("apex_episode_language") === "dub"
        ? "dub"
        : "sub";
    } catch {
      return "sub";
    }
  });
  const matches = accounts.libraryEntries.filter((entry) =>
    sameAnime(entry.anime, anime),
  );
  const progress = Math.min(
    total,
    Math.max(0, ...matches.map((entry) => entry.progress)),
  );
  const continueEpisode = nextDetailEpisode(
    total,
    progress,
    history,
    !!anime.episodes,
  );
  const finished = !!anime.episodes && progress >= total;
  const savedStatus = accounts.getListStatus(anime);
  const synopsis = descriptionText(anime.description);
  const related =
    anime.relations?.edges.filter((edge) => edge.node.type === "ANIME") || [];
  const recommendations =
    anime.recommendations?.nodes
      .map((node) => node.mediaRecommendation)
      .filter(
        (node): node is DashboardAnime & { type?: string; isAdult?: boolean } =>
          !!node && node.type === "ANIME" && !node.isAdult,
      ) || [];
  const changeAudio = (value: "sub" | "dub") => {
    setAudio(value);
    try {
      localStorage.setItem("apex_episode_language", value);
    } catch {}
  };
  const changeStatus = (status: string) => {
    if (!status) return;
    if (!accounts.connected.anilist && !accounts.connected.mal) {
      onConnect();
      return;
    }
    void accounts.sync(
      anime,
      status as ListStatus,
      status === "completed" && anime.episodes ? anime.episodes : undefined,
    );
  };
  return (
    <article className="anime-detail-page">
      <FriendsActivityDock
        animeId={anime.id}
        connected={accounts.connected.anilist}
        checking={accounts.checking}
        identity={accounts.lists?.anilist?.identity}
      />
      <div className="detail-ambient" aria-hidden="true">
        <HeroBackdrop anime={anime} />
      </div>
      <header className="detail-hero">
        <div className="detail-header-art" aria-hidden="true">
          <HeroBackdrop anime={anime} />
          <div className="detail-hero-shade" />
        </div>
        <div className="detail-hero-content">
          <button className="detail-back" onClick={onBack}>
            <ArrowLeft size={18} /> Back
          </button>
          <p className="detail-full-title">{getDisplayTitle(anime)}</p>
          <div className="detail-identity">
            <img
              className="detail-cover"
              src={anime.coverImage?.extraLarge}
              alt={getDisplayTitle(anime) + " poster"}
            />
            <div className="detail-intro">
              <DetailTitle id={anime.id} title={getDisplayTitle(anime)} />
              <div className="detail-metadata">
                <span>{anime.seasonYear || "Year TBA"}</span>
                <span>{anime.format?.replace(/_/g, " ") || "Anime"}</span>
                <span>
                  {anime.episodes
                    ? anime.episodes + " episodes"
                    : "Episode count TBA"}
                </span>
                {anime.genres?.slice(0, 4).map((genre) => (
                  <span className="detail-genre" key={genre}>
                    {genre}
                  </span>
                ))}
              </div>
              <div className="detail-rating-line">
                {anime.averageScore ? (
                  <span className="detail-anilist-rating">
                    <Star size={14} />
                    AniList {(anime.averageScore / 10).toFixed(1)}
                  </span>
                ) : null}
                <AnimeBadges idMal={anime.idMal} />
                <ListEntryEditor
                  anime={anime}
                  accounts={accounts}
                  onConnect={onConnect}
                  afterEdit={
                    <TrailerButton
                      trailer={anime.trailer}
                      title={getDisplayTitle(anime)}
                    />
                  }
                />
              </div>
              <div className="detail-synopsis">
                <p
                  className={
                    expanded || synopsis.length <= 140 ? "" : "is-collapsed"
                  }
                >
                  {synopsis || "Synopsis not available yet."}
                </p>
                {synopsis.length > 140 && (
                  <button
                    aria-expanded={expanded}
                    onClick={() => setExpanded((value) => !value)}
                  >
                    {expanded ? "Read less" : "Read more"}
                  </button>
                )}
              </div>
              <div className="detail-actions">
                <button
                  className="detail-continue"
                  onClick={() =>
                    onPlay(
                      selected,
                      audio,
                      audio === "dub" && source === "apex"
                        ? "megaplay"
                        : source,
                    )
                  }
                >
                  <Play size={18} fill="currentColor" />
                  {selected !== continueEpisode
                    ? "Watch Episode " + selected
                    : finished
                      ? "Watch again"
                      : progress || history
                        ? "Continue Episode " + continueEpisode
                        : "Watch Episode 1"}
                </button>
                <label className="detail-list-status glass">
                  <Bookmark size={16} />
                  <span className="sr-only">List status</span>
                  <select
                    aria-label="List status"
                    value={savedStatus || ""}
                    disabled={accounts.busy || accounts.checking}
                    onChange={(event) => changeStatus(event.target.value)}
                  >
                    <option value="">Add to list</option>
                    {Object.entries(labels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="detail-watch-order-toggle"
                  aria-label="Watch Order"
                  title="Watch Order"
                  aria-expanded={orderId === anime.id}
                  aria-controls="anime-watch-order"
                  onClick={() =>
                    setOrderId((value) =>
                      value === anime.id ? null : anime.id,
                    )
                  }
                >
                  <ListOrdered size={21} aria-hidden="true" />
                </button>
              </div>
              <div className="detail-account-status">
                {(["anilist", "mal"] as const).map((provider) => {
                  const entry = matches.find(
                    (item) => item.provider === provider,
                  );
                  return (
                    <span key={provider}>
                      <CheckCircle2
                        size={13}
                        className={entry ? "has-entry" : ""}
                      />
                      {provider === "mal" ? "MAL" : "AniList"}:{" "}
                      {entry
                        ? labels[entry.status] +
                          " · " +
                          entry.progress +
                          " watched"
                        : accounts.connected[provider]
                          ? "Connected"
                          : "Not connected"}
                    </span>
                  );
                })}
                <button onClick={onConnect}>Manage accounts</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      {orderId === anime.id && (
        <div className="detail-watch-order-wrap">
          <Suspense fallback={<p role="status">Loading Watch Order…</p>}>
            <WatchOrder
              key={anime.id}
              anime={anime}
              accounts={accounts}
              onSelect={onSelect}
              onClose={() => setOrderId(null)}
            />
          </Suspense>
        </div>
      )}
      <nav
        className="detail-section-tabs"
        aria-label="Anime sections"
        role="tablist"
      >
        {(
          [
            ["episodes", "Episodes", total],
            ["related", "Related", related.length],
            ["recommendations", "More Like This", recommendations.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            id={"detail-tab-" + value}
            role="tab"
            aria-selected={tab === value}
            aria-controls={"detail-panel-" + value}
            onClick={() => setTab(value)}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </nav>
      <div className="detail-body">
        <div className="detail-primary-column">
          {tab === "episodes" && (
            <div
              role="tabpanel"
              id="detail-panel-episodes"
              aria-labelledby="detail-tab-episodes"
              className="detail-episodes-panel glass"
            >
              <div className="detail-progress-heading">
                <span>
                  {progress} of {total} watched
                </span>
                <progress
                  aria-label="Watched episode progress"
                  value={progress}
                  max={total}
                />
                <span className="detail-watched-legend">
                  <CheckCircle2 size={14} />
                  Watched
                </span>
              </div>
              <DetailEpisodes
                anime={anime}
                total={total}
                selected={selected}
                accounts={accounts}
                onSelect={onEpisode}
              />
            </div>
          )}
          {tab !== "episodes" && (
            <section
              className="detail-catalog-panel"
              role="tabpanel"
              id={"detail-panel-" + tab}
              aria-labelledby={"detail-tab-" + tab}
            >
              <div className="detail-poster-grid">
                {(tab === "related"
                  ? related.map((edge) => ({
                      anime: edge.node,
                      label: edge.relationType.replace(/_/g, " ").toLowerCase(),
                    }))
                  : recommendations.map((item) => ({
                      anime: item,
                      label: "Recommended",
                    }))
                ).map(({ anime: item, label }) => (
                  <article className="poster-card" key={item.id}>
                    <div className="poster-art">
                      <button
                        className="poster-open"
                        onClick={() => onSelect(item)}
                        aria-label={"View details: " + getDisplayTitle(item)}
                      >
                        <img
                          loading="lazy"
                          src={item.coverImage?.extraLarge}
                          alt=""
                        />
                      </button>
                      <QuickList anime={item} accounts={accounts} />
                    </div>
                    <small>{label}</small>
                    <div className="detail-related-badges">
                      {item.averageScore ? (
                        <span className="detail-related-rating">
                          <Star size={12} /> AniList{" "}
                          {(item.averageScore / 10).toFixed(1)}
                        </span>
                      ) : null}
                      <AnimeBadges idMal={item.idMal} providedScore={null} />
                    </div>
                    <button
                      className="poster-title"
                      onClick={() => onSelect(item)}
                    >
                      {getDisplayTitle(item)}
                    </button>
                  </article>
                ))}
              </div>
              {!(tab === "related"
                ? related.length
                : recommendations.length) && (
                <p>
                  {tab === "related"
                    ? "No related anime available."
                    : "No recommendations available for this anime yet."}
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="detail-sidebar">
          <section className="detail-playback glass" aria-label="Playback">
            <header>
              <h2>Playback</h2>
              <span>Selected: Episode {selected}</span>
            </header>
            <div
              className="detail-audio"
              role="group"
              aria-label="Playback language"
            >
              {(["sub", "dub"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={audio === value}
                  onClick={() => changeAudio(value)}
                >
                  {value === "sub" ? "Sub" : "Dub"}
                </button>
              ))}
            </div>
            <label className="detail-source">
              Source
              <select
                aria-label="Playback source"
                value={
                  audio === "dub" && source === "apex" ? "megaplay" : source
                }
                onChange={(e) =>
                  setSource(e.target.value as "apex" | "megaplay" | "anipm")
                }
              >
                <option value="anipm">Ani.pm (Sub &amp; Dub)</option>
                {audio === "sub" && (
                  <option value="apex">
                    Apex Player · AnimeParadise (Sub)
                  </option>
                )}
                <option value="megaplay">MegaPlay</option>
              </select>
            </label>
            <button
              className="detail-play"
              onClick={() =>
                onPlay(
                  selected,
                  audio,
                  audio === "dub" && source === "apex" ? "megaplay" : source,
                )
              }
            >
              <Play size={17} fill="currentColor" />
              Play Episode {selected}
            </button>
            <p>Stream availability is checked by the player.</p>
            {source === "anipm" && (
              <p>
                Ani.pm includes captions and episode controls. The provider may
                open an ad tab once every five minutes.
              </p>
            )}
            {source === "apex" && audio === "sub" && (
              <p>
                Sub only. Includes subtitles and next/previous episode controls.
                Use MegaPlay if unavailable.
              </p>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}
