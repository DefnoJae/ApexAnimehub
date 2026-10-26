import React, { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  defaultFilters,
  DiscoveryFilters,
  DiscoveryAnime,
  fetchDiscovery,
  fetchGenres,
  matchesListStatus,
} from "../utils/discovery";
import type { useAccounts } from "../hooks/useAccounts";
import { QuickList } from "./HomeDashboard";
import { AnimeBadges } from "./AnimeBadges";

const listStatuses = [
  ["", "Any list status"],
  ["planning", "Planning"],
  ["watching", "Watching"],
  ["completed", "Completed"],
  ["paused", "Paused"],
  ["dropped", "Dropped"],
  ["not-listed", "Not in My List"],
] as const;
function savedFilters(): DiscoveryFilters {
  try {
    const saved = JSON.parse(localStorage.getItem("apex_discovery_v1") || "{}");
    const filters = { ...defaultFilters };
    for (const key of Object.keys(defaultFilters) as Array<
      keyof DiscoveryFilters
    >) {
      if (key !== "genres" && typeof saved[key] === "string")
        (filters[key] as string) = saved[key];
    }
    filters.genres = Array.isArray(saved.genres)
      ? saved.genres.filter(
          (id: unknown) =>
            typeof id === "string" &&
            (/^\d+$/.test(id) || id.startsWith("name:")),
        )
      : [];
    return filters;
  } catch {
    return { ...defaultFilters };
  }
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
  const [genres, setGenres] = useState<
      Array<{ mal_id: number | string; name: string }>
    >([]),
    [genreError, setGenreError] = useState("");
  const [items, setItems] = useState<DiscoveryAnime[]>([]),
    [page, setPage] = useState(1),
    [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [filtersOpen, setFiltersOpen] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLFormElement>(null);
  const catalogRef = useRef<"mal" | "anilist">("mal");
  const [catalog, setCatalog] = useState<"mal" | "anilist">("mal");
  const ratingLabel = catalog === "mal" ? "MAL" : "AniList";
  useEffect(() => {
    const controller = new AbortController();
    void fetchGenres(controller.signal)
      .then(setGenres)
      .catch(() => {
        if (!controller.signal.aborted)
          setGenreError(
            "Genre choices are unavailable. Other filters still work.",
          );
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    setLoading(true);
    setError("");
    void fetchDiscovery(applied, page, controller.signal, catalogRef.current)
      .then((result) => {
        if (!controller.signal.aborted) {
          const replace = page === 1 || result.source !== catalogRef.current;
          setItems((previous) =>
            replace
              ? result.items
              : Array.from(
                  new Map(
                    [...previous, ...result.items].map((item) => [
                      item.idMal ? "mal-" + item.idMal : "ani-" + item.id,
                      item,
                    ]),
                  ).values(),
                ),
          );
          setNextPage(result.nextPage);
          catalogRef.current = result.source;
          setCatalog(result.source);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "Could not load anime",
          );
        else if (!disposed) setError("Discovery timed out. Please retry.");
      })
      .finally(() => {
        clearTimeout(timer);
        if (!disposed) setLoading(false);
      });
    let disposed = false;
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [applied, page, retry]);
  useEffect(() => {
    if (!filtersOpen) return;
    panel.current?.querySelector<HTMLElement>("button, input, select")?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFiltersOpen(false);
        filterButton.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [filtersOpen]);
  const change = (key: keyof DiscoveryFilters, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const apply = (filters = draft) => {
    catalogRef.current = "mal";
    setApplied({ ...filters });
    setItems([]);
    setNextPage(null);
    setPage(1);
    setFiltersOpen(false);
    try {
      localStorage.setItem("apex_discovery_v1", JSON.stringify(filters));
    } catch {}
  };
  const chips = [
    applied.listStatus
      ? listStatuses.find(([value]) => value === applied.listStatus)?.[1]
      : "",
    applied.genres
      .map(
        (id) =>
          genres.find((g) => String(g.mal_id) === id)?.name || "Genre " + id,
      )
      .join(", "),
    applied.from || applied.to
      ? (applied.from || "Any") + "–" + (applied.to || "Now")
      : "",
    applied.season,
    Number(applied.score) ? ratingLabel + " " + applied.score + "+" : "",
    applied.audio === "dub"
      ? "English dub"
      : applied.audio === "sub"
        ? "Sub browsing"
        : "",
    applied.status,
    applied.format,
  ].filter(Boolean);
  const visibleItems = items.filter((anime) =>
    matchesListStatus(anime, accounts.libraryEntries, applied.listStatus),
  );
  return (
    <section className="discovery-page">
      <header className="discovery-heading">
        <div>
          <h1>Discover Anime</h1>
          <p>Find your next obsession.</p>
        </div>
        <label>
          Sort{" "}
          <select
            aria-label="Sort anime"
            value={draft.sort}
            onChange={(e) => {
              const next = { ...draft, sort: e.target.value };
              setDraft(next);
              apply(next);
            }}
          >
            <option value="popularity">Popularity</option>
            <option value="score">Highest {ratingLabel} rating</option>
            <option value="start_date">Newest releases</option>
            <option value="title">Title</option>
          </select>
        </label>
      </header>
      <form
        className="discovery-search glass"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <Search size={20} />
        <input
          aria-label="Search discovery"
          placeholder="Search anime titles…"
          value={draft.search}
          onChange={(e) => change("search", e.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      <button
        ref={filterButton}
        className="mobile-filter-toggle hero-secondary glass"
        aria-expanded={filtersOpen}
        aria-controls="discovery-filters"
        onClick={() => setFiltersOpen(true)}
      >
        <SlidersHorizontal size={18} /> Filters
      </button>
      <div className="discovery-layout">
        {filtersOpen && (
          <button
            className="filter-scrim"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
        )}
        <form
          ref={panel}
          id="discovery-filters"
          className={
            "discovery-filters glass " + (filtersOpen ? "is-open" : "")
          }
          role={filtersOpen ? "dialog" : undefined}
          aria-modal={filtersOpen || undefined}
          aria-label="Discovery filters"
          onKeyDown={(e) => {
            if (!filtersOpen || e.key !== "Tab") return;
            const fields = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button, input, select",
              ),
            ).filter((el) => el.getClientRects().length > 0);
            const first = fields[0],
              last = fields[fields.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <header>
            <h2>Filters</h2>
            <button
              type="button"
              onClick={() => {
                setDraft({ ...defaultFilters });
                apply({ ...defaultFilters });
              }}
            >
              Reset
            </button>
            <button
              className="mobile-filter-close"
              type="button"
              aria-label="Close filters"
              onClick={() => {
                setFiltersOpen(false);
                filterButton.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </header>
          <fieldset>
            <legend>Genre</legend>
            {genreError && <p role="status">{genreError}</p>}
            <div className="genre-options">
              {genres.map((genre) => (
                <label key={genre.mal_id}>
                  <input
                    type="checkbox"
                    checked={draft.genres.includes(String(genre.mal_id))}
                    onChange={(e) =>
                      setDraft((previous) => ({
                        ...previous,
                        genres: e.target.checked
                          ? [...previous.genres, String(genre.mal_id)]
                          : previous.genres.filter(
                              (id) => id !== String(genre.mal_id),
                            ),
                      }))
                    }
                  />
                  {genre.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Year</legend>
            <div className="year-range">
              <input
                aria-label="From year"
                type="number"
                min="1900"
                max="2100"
                placeholder="From"
                value={draft.from}
                onChange={(e) => change("from", e.target.value)}
              />
              <span>–</span>
              <input
                aria-label="To year"
                type="number"
                min="1900"
                max="2100"
                placeholder="To"
                value={draft.to}
                onChange={(e) => change("to", e.target.value)}
              />
            </div>
          </fieldset>
          <label>
            Season
            <select
              value={draft.season}
              onChange={(e) => change("season", e.target.value)}
            >
              <option value="">Any season</option>
              {["winter", "spring", "summer", "fall"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum rating{" "}
            <strong>
              {ratingLabel} {draft.score}+
            </strong>
            <input
              type="range"
              min="0"
              max="9"
              step="0.5"
              value={draft.score}
              onChange={(e) => change("score", e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Audio</legend>
            <div className="audio-options">
              {["any", "sub", "dub"].map((audio) => (
                <button
                  type="button"
                  key={audio}
                  aria-pressed={draft.audio === audio}
                  onClick={() => change("audio", audio)}
                >
                  {audio}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Airing status
            <select
              value={draft.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="">Any status</option>
              <option value="airing">Airing</option>
              <option value="complete">Finished</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </label>
          <label>
            My list status
            <select
              value={draft.listStatus || ""}
              onChange={(e) => change("listStatus", e.target.value)}
            >
              {listStatuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select
              value={draft.format}
              onChange={(e) => change("format", e.target.value)}
            >
              <option value="">Any format</option>
              <option value="tv">TV series</option>
              <option value="movie">Movie</option>
              <option value="ova">OVA</option>
              <option value="ona">ONA</option>
              <option value="special">Special</option>
            </select>
          </label>
          <button className="apply-filters" type="submit">
            Apply filters
          </button>
        </form>
        <div className="discovery-results">
          <div className="section-heading">
            <h2>Popular matches</h2>
            <span>
              {visibleItems.length} matches · {items.length} loaded
            </span>
          </div>
          <div className="filter-chips">
            {chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <p className="discovery-note">
            {catalog === "mal"
              ? "MAL ratings via Jikan."
              : "MAL catalog is currently unavailable. Browsing AniList instead; rating filters and labeled scores use AniList."}{" "}
            Dub includes full and partial English dubs from MyDubList. Sub
            browsing does not exclude dubbed anime; available streams are
            checked in the player.
            {(applied.audio === "dub" || applied.season) &&
              " Matches are filtered across batches of up to four source pages; load more to keep searching."}
          </p>
          {applied.listStatus && (
            <p className="discovery-note">
              List status uses your imported connected lists and filters the
              loaded catalog results. Load more to search further.
              {accounts.libraryLoading &&
                " Your lists are still importing; matches may change."}
              {Object.keys(accounts.libraryErrors || {}).length > 0 &&
                " Some lists could not be imported; results may be incomplete."}
            </p>
          )}
          {error && (
            <p role="alert">
              {error}{" "}
              <button onClick={() => setRetry((value) => value + 1)}>
                Retry
              </button>
            </p>
          )}
          <div className="discovery-grid">
            {visibleItems.map((anime) => (
              <article
                className="poster-card"
                key={anime.idMal ? "mal-" + anime.idMal : "ani-" + anime.id}
              >
                <div className="poster-art">
                  <button
                    className="poster-open"
                    aria-label={"View details: " + anime.title.english}
                    onClick={() => onSelect(anime)}
                  >
                    <img
                      loading="lazy"
                      src={anime.coverImage?.extraLarge}
                      alt=""
                    />
                  </button>
                  <QuickList anime={anime} accounts={accounts} />
                </div>
                <button
                  className="poster-title"
                  onClick={() => onSelect(anime)}
                >
                  {anime.title.english}
                </button>
                <small>
                  {anime.year || "Year TBA"} · {anime.format}
                </small>
                <AnimeBadges
                  idMal={anime.idMal}
                  providedScore={anime.malScore}
                />
                {anime.anilistScore != null && (
                  <span className="catalog-score">
                    ★ AniList {anime.anilistScore.toFixed(1)}
                  </span>
                )}
              </article>
            ))}
          </div>
          {loading && <p role="status">Finding your next anime…</p>}
          {!loading && !error && !visibleItems.length && (
            <p>
              No matches in this batch. Try broader filters
              {nextPage ? " or load more results." : "."}
            </p>
          )}
          {nextPage && !loading && (
            <button
              className="load-more hero-secondary glass"
              onClick={() => setPage(nextPage)}
            >
              Load more results
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
