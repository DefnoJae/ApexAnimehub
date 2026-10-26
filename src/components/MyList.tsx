import React, { useState } from "react";
import type { useAccounts, ListStatus } from "../hooks/useAccounts";
import { LibraryAnime } from "../hooks/useLibrary";
import { QuickList } from "./HomeDashboard";
import { AnimeBadges } from "./AnimeBadges";
const labels = {
  watching: "Watching",
  planning: "Planning",
  completed: "Completed",
  paused: "On hold",
  dropped: "Dropped",
};
export function MyList({
  accounts,
  onSelect,
  onConnect,
}: {
  accounts: ReturnType<typeof useAccounts>;
  onSelect: (anime: LibraryAnime) => void;
  onConnect: () => void;
}) {
  const [status, setStatus] = useState<ListStatus | "all">("all");
  const [provider, setProvider] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = accounts.libraryEntries.filter(
    (e) =>
      (provider === "all" || provider === e.provider) &&
      (status === "all" || status === e.status) &&
      (e.anime.title?.english || e.anime.title?.romaji || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const keyFor = (anime: LibraryAnime) =>
    anime.idMal ? "mal-" + anime.idMal : "ani-" + anime.id;
  const grouped = new Map<string, typeof accounts.libraryEntries>();
  accounts.libraryEntries.forEach((entry) => {
    const key = keyFor(entry.anime);
    grouped.set(key, [...(grouped.get(key) || []), entry]);
  });
  const unique = Array.from(
    new Map(filtered.map((entry) => [keyFor(entry.anime), entry])).values(),
  );
  return (
    <section className="my-library">
      <div className="section-heading">
        <h1>My List</h1>
        <button
          className="hero-secondary glass"
          disabled={accounts.libraryLoading}
          onClick={() => void accounts.refreshLibrary()}
        >
          {accounts.libraryLoading ? "Importing…" : "Refresh lists"}
        </button>
      </div>
      <p>
        Your connected lists, saved on this device. Different provider statuses
        are shown separately; importing never overwrites either account.
      </p>
      {!accounts.connected.anilist && !accounts.connected.mal && (
        <button className="hero-primary" onClick={onConnect}>
          Connect AniList or MyAnimeList
        </button>
      )}
      <div className="library-filters">
        <input
          aria-label="Search my list"
          placeholder="Search your anime…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="List provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="all">All accounts</option>
          <option value="anilist">AniList</option>
          <option value="mal">MyAnimeList</option>
        </select>
        <select
          aria-label="Filter list status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ListStatus | "all")}
        >
          <option value="all">All statuses</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {Object.entries(accounts.libraryErrors).map(([p, error]) => (
        <p role="alert" key={p}>
          {p === "mal" ? "MyAnimeList" : "AniList"}: {error}{" "}
          {error?.includes("429") &&
            "The provider is busy; automatically retrying in about a minute. "}{" "}
          Saved entries are kept when available. Retry with Refresh lists.
        </p>
      ))}
      {Object.entries(accounts.lists)
        .filter(
          ([p, list]) => !!list && accounts.connected[p as "mal" | "anilist"],
        )
        .map(([p, list]) => (
          <p className="library-updated" key={p}>
            {p === "mal" ? "MyAnimeList" : "AniList"} · {list?.name} ·{" "}
            {list?.entries.length} anime{" "}
            {list?.complete === false ? "· Partial import" : ""} · Updated{" "}
            {list && new Date(list.updatedAt).toLocaleString()}
          </p>
        ))}
      {accounts.libraryLoading && (
        <p role="status">Importing all pages from your connected accounts…</p>
      )}
      {!unique.length && !accounts.libraryLoading && (
        <p>No anime in this view.</p>
      )}
      <div className="library-grid">
        {unique.map((entry) => (
          <article
            className="poster-card"
            key={entry.anime.id || "mal-" + entry.anime.idMal}
          >
            <div className="poster-art">
              <button
                className="poster-open"
                onClick={() => onSelect(entry.anime)}
                aria-label={
                  "View details: " +
                  (entry.anime.title?.english || entry.anime.title?.romaji)
                }
              >
                <img
                  loading="lazy"
                  src={entry.anime.coverImage?.extraLarge}
                  alt=""
                />
              </button>
              <QuickList
                anime={{ ...entry.anime, title: entry.anime.title || {} }}
                accounts={accounts}
              />
            </div>
            <button
              className="poster-title"
              onClick={() => onSelect(entry.anime)}
            >
              {entry.anime.title?.english || entry.anime.title?.romaji}
            </button>
            <AnimeBadges idMal={entry.anime.idMal} />
            {(grouped.get(keyFor(entry.anime)) || []).map((e) => (
              <small className="library-status" key={e.provider}>
                {e.provider === "mal" ? "MAL" : "AniList"} · {labels[e.status]}{" "}
                · {e.progress}/{e.anime.episodes || "?"} episodes
                {e.score !== undefined && (
                  <span>
                    {" "}
                    · Your score: {e.score > 0 ? e.score + "/10" : "Unrated"}
                  </span>
                )}
              </small>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
