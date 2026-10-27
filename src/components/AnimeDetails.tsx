import React, { useState } from "react";
import { ArrowLeft, Bookmark, CheckCircle2, Play, Star } from "lucide-react";
import type { DashboardAnime, WatchEntry } from "./HomeDashboard";
import type { ListStatus, useAccounts } from "../hooks/useAccounts";
import { sameAnime } from "../hooks/useLibrary";
import { getDisplayTitle } from "../utils/schedule";
import { HeroBackdrop } from "./HeroBackdrop";
import { AnimeBadges } from "./AnimeBadges";
import { EpisodePicker } from "./EpisodePicker";
import { ListEntryEditor } from "./ListEntryEditor";
import "./animeDetails.css";
export interface DetailAnime extends DashboardAnime {
  seasonYear?: number;
  format?: string;
  status?: string;
  genres?: string[];
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
  const [expanded, setExpanded] = useState(false);
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
      <header className="detail-hero">
        <HeroBackdrop anime={anime} />
        <div className="detail-hero-shade" />
        <div className="detail-hero-content">
          <button className="detail-back" onClick={onBack}>
            <ArrowLeft size={18} /> Back
          </button>
          <div className="detail-identity">
            <img
              className="detail-cover"
              src={anime.coverImage?.extraLarge}
              alt={getDisplayTitle(anime) + " poster"}
            />
            <div className="detail-intro">
              <h1>{getDisplayTitle(anime)}</h1>
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
                      continueEpisode,
                      audio,
                      audio === "dub" && source === "apex"
                        ? "megaplay"
                        : source,
                    )
                  }
                >
                  <Play size={18} fill="currentColor" />
                  {finished
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
      <div className="detail-body">
        <div className="detail-primary-column">
          <div className="detail-episodes-panel glass">
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
            <EpisodePicker
              anime={anime}
              total={total}
              selected={selected}
              entries={accounts.libraryEntries}
              importing={accounts.libraryLoading}
              onSelect={onEpisode}
            />
          </div>
          {related.length > 0 && (
            <section
              className="detail-related glass"
              aria-label="Related anime"
            >
              <h2>Related anime</h2>
              <div className="detail-related-track">
                {related.map((edge) => (
                  <button
                    key={edge.node.id + edge.relationType}
                    onClick={() => onSelect(edge.node)}
                  >
                    <img
                      loading="lazy"
                      src={
                        edge.node.bannerImage ||
                        edge.node.coverImage?.extraLarge
                      }
                      alt=""
                    />
                    <span className="detail-relation-label">
                      {edge.relationType.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <strong>{getDisplayTitle(edge.node)}</strong>
                  </button>
                ))}
              </div>
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
          <section className="detail-info glass" aria-label="Anime info">
            <h2>Anime info</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>
                  {anime.status?.replace(/_/g, " ").toLowerCase() || "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Studio</dt>
                <dd>
                  {anime.studios?.nodes
                    .map((studio) => studio.name)
                    .join(", ") || "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{anime.format?.replace(/_/g, " ") || "Unknown"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </article>
  );
}
