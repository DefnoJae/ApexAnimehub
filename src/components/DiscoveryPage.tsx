import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  defaultFilters,
  DiscoveryFilters,
  DiscoveryAnime,
  fetchDiscovery,
  fetchDiscoveryOptions,
  matchesListStatus,
} from "../utils/discovery";
import type { useAccounts } from "../hooks/useAccounts";
import { QuickList } from "./HomeDashboard";
import { AnimeBadges } from "./AnimeBadges";
import "./discovery.css";
const statuses = [
  ["", "Any list status"],
  ["planning", "Planning"],
  ["watching", "Watching"],
  ["completed", "Completed"],
  ["paused", "Paused"],
  ["dropped", "Dropped"],
  ["not-listed", "Not in My List"],
];
function savedFilters(): DiscoveryFilters {
  try {
    const saved = JSON.parse(
      localStorage.getItem("apex_discovery_v2") || "null",
    );
    if (saved)
      return {
        ...defaultFilters,
        ...saved,
        genres: Array.isArray(saved.genres)
          ? saved.genres.filter(
              (v: unknown) => typeof v === "string" && v.startsWith("name:"),
            )
          : [],
        tags: Array.isArray(saved.tags)
          ? saved.tags.filter((v: unknown) => typeof v === "string")
          : [],
      };
  } catch {}
  return { ...defaultFilters, sort: "trending" };
}
function Choices({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <details className="discovery-choice">
      <summary>
        {label}
        {selected.length ? " +" + selected.length : ""}
      </summary>
      <div className="discovery-choice-menu">
        <input
          aria-label={"Find " + label.toLowerCase()}
          placeholder={"Find " + label.toLowerCase() + "..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div>
          {options
            .filter((name) => name.toLowerCase().includes(search.toLowerCase()))
            .map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, name]
                        : selected.filter((v) => v !== name),
                    )
                  }
                />
                {name}
              </label>
            ))}
        </div>
      </div>
    </details>
  );
}
export function DiscoveryPage({
  accounts,
  onSelect,
}: {
  accounts: ReturnType<typeof useAccounts>;
  onSelect: (anime: DiscoveryAnime) => void;
}) {
  const [draft, setDraft] = useState(savedFilters),
    [applied, setApplied] = useState(savedFilters);
  const [options, setOptions] = useState<{ genres: string[]; tags: string[] }>({
      genres: [],
      tags: [],
    }),
    [optionError, setOptionError] = useState("");
  const [items, setItems] = useState<DiscoveryAnime[]>([]),
    [page, setPage] = useState(1),
    [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const listUnavailable =
    !!draft.listStatus &&
    draft.listStatus !== "not-listed" &&
    !accounts.connected.anilist &&
    !accounts.connected.mal;
  const sentinel = useRef<HTMLDivElement>(null),
    loadLock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetchDiscoveryOptions(controller.signal)
      .then(setOptions)
      .catch(() => {
        if (!controller.signal.aborted)
          setOptionError("Genre and tag choices are temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(applied)) return;
    const timer = setTimeout(() => {
      loadLock.current = true;
      setApplied(draft);
      setItems([]);
      setNextPage(null);
      setPage(1);
      setError("");
      try {
        localStorage.setItem("apex_discovery_v2", JSON.stringify(draft));
      } catch {}
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, applied]);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(), 30000);
    loadLock.current = true;
    setLoading(true);
    setError("");
    void fetchDiscovery(applied, page, controller.signal, "anilist")
      .then((result) => {
        if (disposed || controller.signal.aborted) return;
        setItems((previous) =>
          Array.from(
            new Map(
              (page === 1 ? result.items : [...previous, ...result.items]).map(
                (item) => [
                  item.idMal ? "mal-" + item.idMal : "ani-" + item.id,
                  item,
                ],
              ),
            ).values(),
          ),
        );
        setNextPage(result.nextPage);
      })
      .catch((reason) => {
        if (!disposed)
          setError(
            controller.signal.aborted
              ? "Discovery timed out. Please retry."
              : reason instanceof Error
                ? reason.message
                : "Could not load anime.",
          );
      })
      .finally(() => {
        clearTimeout(timer);
        if (!disposed) {
          loadLock.current = false;
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [applied, page, retry]);
  useEffect(() => {
    if (
      listUnavailable ||
      !sentinel.current ||
      loading ||
      error ||
      !nextPage ||
      JSON.stringify(draft) !== JSON.stringify(applied)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          !loadLock.current
        ) {
          loadLock.current = true;
          setPage(nextPage);
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loading, error, nextPage, draft, applied, listUnavailable]);
  const change = (key: keyof DiscoveryFilters, value: string) =>
    setDraft((p) => ({ ...p, [key]: value }));
  const visible = items.filter((anime) =>
    matchesListStatus(anime, accounts.libraryEntries, applied.listStatus),
  );
  const genres = draft.genres.map((id) => id.replace(/^name:/, ""));
  const chips = [
    ...genres.map((name) => ({
      label: name,
      remove: () =>
        setDraft((p) => ({
          ...p,
          genres: p.genres.filter((v) => v !== "name:" + name),
        })),
    })),
    ...(draft.tags || []).map((name) => ({
      label: name,
      remove: () =>
        setDraft((p) => ({ ...p, tags: p.tags?.filter((v) => v !== name) })),
    })),
  ];
  const select = (
    label: string,
    key: keyof DiscoveryFilters,
    choices: string[][],
  ) => (
    <label className="discovery-inline-filter">
      <span>{label}</span>
      <select
        aria-label={label}
        value={String(draft[key] || "")}
        onChange={(e) => change(key, e.target.value)}
      >
        {choices.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="discovery-page discovery-refresh">
      <header className="discovery-heading">
        <div>
          <h1>Discover Anime</h1>
          <p>{visible.length} anime loaded</p>
        </div>
      </header>
      <div className="discovery-toolbar">
        <label className="discovery-inline-search">
          <Search size={17} />
          <input
            aria-label="Search discovery"
            placeholder="Search anime..."
            value={draft.search}
            onChange={(e) => change("search", e.target.value)}
          />
        </label>
        {select("Sort anime", "sort", [
          ["trending", "Trending"],
          ["popularity", "Popular"],
          ["score", "Top rated"],
          ["start_date", "Newest"],
          ["title", "A-Z"],
        ])}
        <Choices
          label="Genres"
          options={options.genres}
          selected={genres}
          onChange={(names) =>
            setDraft((p) => ({
              ...p,
              genres: names.map((name) => "name:" + name),
            }))
          }
        />
        <Choices
          label="Tags"
          options={options.tags}
          selected={draft.tags || []}
          onChange={(tags) => setDraft((p) => ({ ...p, tags }))}
        />
        <details className="discovery-choice">
          <summary>Year</summary>
          <div className="discovery-choice-menu discovery-years">
            {(["from", "to"] as const).map((key) => (
              <label key={key}>
                {key}
                <input
                  aria-label={key + " year"}
                  type="number"
                  min="1900"
                  max="2100"
                  placeholder="Any"
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </details>
        {select("Season", "season", [
          ["", "Any season"],
          ...["winter", "spring", "summer", "fall"].map((v) => [v, v]),
        ])}
        {select("Format", "format", [
          ["", "Any format"],
          ...["TV", "Movie", "OVA", "ONA", "Special"].map((v) => [
            v.toLowerCase(),
            v,
          ]),
        ])}
        {select("Airing status", "status", [
          ["", "Any status"],
          ["airing", "Airing"],
          ["complete", "Finished"],
          ["upcoming", "Upcoming"],
        ])}
        {select("Language", "audio", [
          ["any", "Sub & Dub"],
          ["sub", "Sub"],
          ["dub", "English dub"],
        ])}
        {select("Minimum rating", "score", [
          ["0", "Any rating"],
          ...[5, 6, 7, 8, 9].map((v) => [String(v), v + "+ / 10"]),
        ])}
        {select("My list status", "listStatus", statuses)}
      </div>
      <div className="discovery-active-filters">
        {chips.map((chip) => (
          <button key={chip.label} onClick={chip.remove}>
            {chip.label}
            <X size={12} />
          </button>
        ))}
        <button
          className="discovery-clear"
          onClick={() => setDraft({ ...defaultFilters, sort: "trending" })}
        >
          Clear all
        </button>
      </div>
      {listUnavailable && (
        <p role="status">
          Connect AniList or MyAnimeList in account settings to browse your
          saved lists.
        </p>
      )}
      {draft.listStatus &&
        (accounts.libraryLoading ||
          Object.keys(accounts.libraryErrors || {}).length > 0) && (
          <p role="status">
            Your imported lists are incomplete; list-filtered results may change
            as accounts refresh.
          </p>
        )}
      {optionError && <p role="status">{optionError}</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
        </p>
      )}
      <div className="discovery-grid" aria-busy={loading}>
        {visible.map((anime) => (
          <article
            className="poster-card"
            key={anime.idMal ? "mal-" + anime.idMal : "ani-" + anime.id}
          >
            <div className="poster-art">
              <button
                className="poster-open"
                aria-label={
                  "View details: " + (anime.title.english || anime.title.romaji)
                }
                onClick={() => onSelect(anime)}
              >
                <img loading="lazy" src={anime.coverImage?.extraLarge} alt="" />
              </button>
              <QuickList anime={anime} accounts={accounts} />
              <div className="discovery-poster-caption">
                <strong>{anime.title.english || anime.title.romaji}</strong>
                <small>
                  {anime.year || "TBA"} · {anime.format}
                  {anime.anilistScore != null
                    ? " · ★ " + anime.anilistScore.toFixed(1)
                    : ""}
                </small>
              </div>
            </div>
            <AnimeBadges idMal={anime.idMal} providedScore={anime.malScore} />
          </article>
        ))}
      </div>
      {loading && (
        <p role="status">
          {page === 1 ? "Finding your next anime..." : "Loading more anime..."}
        </p>
      )}
      {!loading && !error && !visible.length && (
        <p>
          No matches
          {nextPage
            ? " in this batch. Checking more results as you scroll..."
            : ". Try broader filters."}
        </p>
      )}
      <div ref={sentinel} className="discovery-sentinel" aria-hidden="true" />
      {!nextPage && !loading && !error && visible.length > 0 && (
        <p className="discovery-end">
          You have reached the end of these results.
        </p>
      )}
    </section>
  );
}
