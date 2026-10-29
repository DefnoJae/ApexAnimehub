import React, { useEffect, useState } from "react";
import { Check, Grid2X2, ListOrdered } from "lucide-react";
import {
  fetchEpisodeMetadata,
  EpisodeMetadata,
} from "../utils/episodeMetadata";
import {
  fetchEpisodeAvailability,
  EpisodeAvailability,
} from "../utils/episodeAvailability";
import { EpisodePicker } from "./EpisodePicker";
import type { DashboardAnime } from "./HomeDashboard";
import type { useAccounts } from "../hooks/useAccounts";
import { sameAnime } from "../hooks/useLibrary";
export function DetailEpisodes({
  anime,
  total,
  selected,
  accounts,
  onSelect,
  onLanguage,
}: {
  anime: DashboardAnime;
  total: number;
  selected: number;
  accounts: ReturnType<typeof useAccounts>;
  onSelect: (episode: number) => void;
  onLanguage?: (language: "sub" | "dub") => void;
}) {
  const [data, setData] = useState<{
      id: number;
      episodes: Record<string, EpisodeMetadata>;
    }>({ id: 0, episodes: {} }),
    [search, setSearch] = useState(""),
    [numbers, setNumbers] = useState(false),
    [limit, setLimit] = useState(50);
  const [availability, setAvailability] = useState<EpisodeAvailability | null>(
      null,
    ),
    [language, setLanguage] = useState<"all" | "sub" | "dub">("all"),
    [availabilityError, setAvailabilityError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setAvailability(null);
    setAvailabilityError("");
    void fetchEpisodeAvailability(anime.id, controller.signal)
      .then((value) => {
        if (active) setAvailability(value);
      })
      .catch(() => {
        if (active)
          setAvailabilityError(
            "Availability unavailable. All episodes remain accessible.",
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [anime.id, retry]);
  useEffect(() => {
    if (language !== "all" && availability) {
      const available = availability[language];
      if (available.length && !available.includes(selected))
        onSelect(available[0]);
    }
  }, [language, availability, selected, onSelect]);
  useEffect(() => {
    let active = true;
    setSearch("");
    setLimit(50);
    void fetchEpisodeMetadata(anime.id).then((episodes) => {
      if (active) setData({ id: anime.id, episodes });
    });
    return () => {
      active = false;
    };
  }, [anime.id]);
  const episodes = data.id === anime.id ? data.episodes : {};
  const progress = Math.max(
    0,
    ...accounts.libraryEntries
      .filter((e) => sameAnime(e.anime, anime))
      .map((e) => e.progress),
  );
  const filtered = (
    language !== "all" && availability
      ? availability[language]
      : Array.from(
          {
            length: Math.max(
              total,
              ...(availability?.sub || []),
              ...(availability?.dub || []),
            ),
          },
          (_, i) => i + 1,
        )
  ).filter(
    (n) =>
      !search ||
      String(n) === search.trim() ||
      episodes[String(n)]?.title?.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="detail-episode-browser" aria-label="Episodes">
      <div className="detail-episode-tools">
        <input
          aria-label="Search episodes"
          placeholder="Search episodes..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(50);
          }}
        />
        <button
          aria-label="Episode cards"
          aria-pressed={!numbers}
          onClick={() => setNumbers(false)}
        >
          <Grid2X2 size={17} />
        </button>
        <button
          aria-label="Episode numbers"
          aria-pressed={numbers}
          onClick={() => setNumbers(true)}
        >
          <ListOrdered size={17} />
        </button>
      </div>
      <div
        className="detail-availability-filters"
        role="group"
        aria-label="Episode availability"
      >
        <button
          aria-pressed={language === "all"}
          onClick={() => {
            setLanguage("all");
            setLimit(50);
          }}
        >
          All episodes
        </button>
        {(["sub", "dub"] as const).map((value) => (
          <button
            key={value}
            disabled={!availability}
            aria-pressed={language === value}
            onClick={() => {
              setLanguage(value);
              onLanguage?.(value);
              setLimit(50);
            }}
          >
            {value === "sub" ? "Sub only" : "Dub only"}{" "}
            {availability ? availability[value].length : "…"}
          </button>
        ))}
        <small>Availability on Ani.pm</small>
      </div>
      {availabilityError && (
        <p role="status">
          {availabilityError}{" "}
          <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
        </p>
      )}
      {numbers ? (
        <EpisodePicker
          anime={anime}
          total={total}
          selected={selected}
          episodeNumbers={filtered}
          entries={accounts.libraryEntries}
          importing={accounts.libraryLoading}
          onSelect={onSelect}
        />
      ) : (
        <>
          <div className="detail-episode-cards">
            {filtered.slice(0, limit).map((number) => {
              const meta = episodes[String(number)];
              return (
                <button
                  key={number}
                  className={
                    "detail-episode-card" +
                    (number === selected ? " is-selected" : "") +
                    (number <= progress ? " is-watched" : "")
                  }
                  aria-label={
                    "Episode " +
                    number +
                    (number <= progress ? ", watched" : ", not marked watched")
                  }
                  aria-pressed={number === selected}
                  onClick={() => onSelect(number)}
                >
                  <div className="detail-episode-still">
                    {meta?.image ? (
                      <img loading="lazy" src={meta.image} alt="" />
                    ) : (
                      <span className="episode-image-placeholder">
                        {number}
                      </span>
                    )}
                    <span>Episode {number}</span>
                    {meta?.runtime && <small>{meta.runtime} min</small>}
                    {number <= progress && (
                      <Check className="episode-watched-check" size={18} />
                    )}
                  </div>
                  <div className="detail-episode-description">
                    <strong>{meta?.title || "Episode " + number}</strong>
                    {meta?.overview && <p>{meta.overview}</p>}
                    {meta?.airDate && <small>{meta.airDate}</small>}
                  </div>
                </button>
              );
            })}
          </div>
          {!filtered.length && <p>No episodes match your search.</p>}
          {filtered.length > limit && (
            <button
              className="detail-episode-more"
              onClick={() => setLimit((v) => v + 50)}
            >
              Show more episodes
            </button>
          )}
        </>
      )}
    </section>
  );
}
