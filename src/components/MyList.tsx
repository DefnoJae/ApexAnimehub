import { StyledSelect } from "./StyledSelect";
import React, { useEffect, useRef, useState } from "react";
import { isRateLimitError } from "../utils/anilist";
import type { useAccounts, ListStatus } from "../hooks/useAccounts";
import { LibraryAnime } from "../hooks/useLibrary";
import { QuickList } from "./HomeDashboard";
import { PersonalRating } from "./RatingPills";
import { AnimeBadges } from "./AnimeBadges";

const batchSize = 50;

type MyListFilters = {
  status: ListStatus | "all";
  provider: string;
  search: string;
  sort: string;
};

const FILTERS_KEY = "apex_my_list_filters_v1";
const LEGACY_SORT_KEY = "apex_my_list_sort_v1";

const validStatuses: string[] = [
  "all",
  "watching",
  "planning",
  "completed",
  "paused",
  "dropped",
];
const validProviders: string[] = ["all", "anilist", "mal"];
const validSorts: string[] = [
  "updated",
  "highest",
  "lowest",
  "progress",
  "title",
];

function validValue(
  value: unknown,
  allowed: string[],
  fallback: string,
): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function readFilters(): MyListFilters {
  const fallback: MyListFilters = {
    status: "all",
    provider: "all",
    search: "",
    sort: "updated",
  };
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MyListFilters> | null;
      if (parsed && typeof parsed === "object") {
        return {
          status: validValue(
            parsed.status,
            validStatuses,
            fallback.status,
          ) as MyListFilters["status"],
          provider: validValue(parsed.provider, validProviders, fallback.provider),
          search:
            typeof parsed.search === "string" ? parsed.search : fallback.search,
          sort: validValue(parsed.sort, validSorts, fallback.sort),
        };
      }
    }
  } catch {}
  try {
    const legacySort = localStorage.getItem(LEGACY_SORT_KEY);
    if (legacySort && validSorts.includes(legacySort)) {
      return { ...fallback, sort: legacySort };
    }
  } catch {}
  return fallback;
}

function saveFilters(next: MyListFilters): void {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  } catch {}
}

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
  const [initial] = useState(readFilters);
  const [status, setStatus] = useState<ListStatus | "all">(initial.status);
  const [provider, setProvider] = useState(initial.provider);
  const [search, setSearch] = useState(initial.search);
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinel = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState(initial.sort);
  useEffect(() => saveFilters({ status, provider, search, sort }), [
    status,
    provider,
    search,
    sort,
  ]);
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
  const hasMore = visibleCount < unique.length;
  const canObserve = typeof IntersectionObserver !== "undefined";
  useEffect(() => {
    if (!hasMore || !canObserve || !sentinel.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setVisibleCount((count) => count + batchSize);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, canObserve, visibleCount, search, provider, status, sort]);
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
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(batchSize);
          }}
        />
        <StyledSelect
          aria-label="List provider"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setVisibleCount(batchSize);
          }}
        >
          <option value="all">All accounts</option>
          <option value="anilist">AniList</option>
          <option value="mal">MyAnimeList</option>
        </StyledSelect>
        <StyledSelect
          aria-label="Filter list status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ListStatus | "all");
            setVisibleCount(batchSize);
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </StyledSelect>
        <StyledSelect
          aria-label="Sort my list"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setVisibleCount(batchSize);
          }}
        >
          <option value="updated">Recently updated</option>
          <option value="highest">My highest rated</option>
          <option value="lowest">My lowest rated</option>
          <option value="progress">Most watched</option>
          <option value="title">Title A–Z</option>
        </StyledSelect>
      </div>
      {Object.entries(accounts.libraryErrors).map(([p, error]) => (
        <p role="alert" key={p}>
          {p === "mal" ? "MyAnimeList" : "AniList"}: {error}{" "}
          {isRateLimitError(error) &&
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
        {unique.slice(0, visibleCount).map((entry) => {
          const entries = entriesFor(entry.anime);
          const inProgress = entries.filter((item) =>
            (item.status === "watching" || item.status === "paused") &&
            (status === "all" || item.status === status),
          );
          const watched = Math.max(0, ...inProgress.map((item) => item.progress));
          const total = entry.anime.episodes || entries.find((item) => item.anime.episodes)?.anime.episodes;
          return (
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
                {inProgress.length > 0 && (
                  <span className="my-list-progress" aria-label={total ? `${watched} of ${total} episodes watched` : `${watched} episodes watched, total unknown`}>
                    {watched}/{total || "?"}
                  </span>
                )}
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
          );
        })}
      </div>
      {hasMore && (canObserve ? (
        <div ref={sentinel} className="discovery-sentinel" aria-hidden="true" />
      ) : (
        <button
          className="hero-secondary glass"
          onClick={() => setVisibleCount((count) => count + batchSize)}
        >
          Load more
        </button>
      ))}
    </section>
  );
}
