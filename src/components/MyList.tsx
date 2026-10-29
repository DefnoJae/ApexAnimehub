import React, { useState } from "react";
import type { useAccounts, ListStatus } from "../hooks/useAccounts";
import { LibraryAnime } from "../hooks/useLibrary";
import { QuickList } from "./HomeDashboard";
import { PersonalRating } from "./RatingPills";
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
  const [sort, setSort] = useState(() => {
    try {
      return localStorage.getItem("apex_my_list_sort_v1") || "updated";
    } catch {
      return "updated";
    }
  });
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
  const entriesFor = (anime: LibraryAnime) =>
    (grouped.get(keyFor(anime)) || []).filter(
      (entry) => provider === "all" || entry.provider === provider,
    );
  const scoreFor = (anime: LibraryAnime) => {
    const entries = entriesFor(anime);
    return (
      entries.find(
        (entry) => entry.provider === "anilist" && (entry.score || 0) > 0,
      )?.score ||
      entries.find((entry) => (entry.score || 0) > 0)?.score ||
      0
    );
  };
  const updated = (anime: LibraryAnime) =>
    Math.max(0, ...entriesFor(anime).map((entry) => entry.updatedAt));
  unique.sort((a, b) =>
    sort === "highest"
      ? scoreFor(b.anime) - scoreFor(a.anime)
      : sort === "lowest"
        ? (scoreFor(a.anime) || Infinity) - (scoreFor(b.anime) || Infinity)
        : sort === "progress"
          ? Math.max(0, ...entriesFor(b.anime).map((entry) => entry.progress)) -
            Math.max(0, ...entriesFor(a.anime).map((entry) => entry.progress))
          : sort === "title"
            ? (
                a.anime.title?.english ||
                a.anime.title?.romaji ||
                ""
              ).localeCompare(
                b.anime.title?.english || b.anime.title?.romaji || "",
              )
            : updated(b.anime) - updated(a.anime),
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
      <p>Your connected anime lists, saved on this device.</p>
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
        <select
          aria-label="Sort my list"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            try {
              localStorage.setItem("apex_my_list_sort_v1", event.target.value);
            } catch {}
          }}
        >
          <option value="updated">Recently updated</option>
          <option value="highest">My highest rated</option>
          <option value="lowest">My lowest rated</option>
          <option value="progress">Most watched</option>
          <option value="title">Title A–Z</option>
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
              <PersonalRating
                score={scoreFor(entry.anime)}
                className="my-list-score"
              />
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
            <div className="library-card-badges">
              <AnimeBadges
                id={
                  (grouped.get(keyFor(entry.anime)) || []).find(
                    (e) => e.anime.id,
                  )?.anime.id
                }
                idMal={entry.anime.idMal}
                averageScore={
                  (grouped.get(keyFor(entry.anime)) || []).find(
                    (e) => e.anime.averageScore,
                  )?.anime.averageScore
                }
                providedScore={
                  (grouped.get(keyFor(entry.anime)) || []).find(
                    (e) => e.anime.malScore,
                  )?.anime.malScore || undefined
                }
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
