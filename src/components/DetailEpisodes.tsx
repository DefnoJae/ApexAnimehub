import React, { useEffect, useState } from "react";
import { Check, Grid2X2, ListOrdered } from "lucide-react";
import {
  fetchEpisodeMetadata,
  EpisodeMetadata,
} from "../utils/episodeMetadata";
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
}: {
  anime: DashboardAnime;
  total: number;
  selected: number;
  accounts: ReturnType<typeof useAccounts>;
  onSelect: (episode: number) => void;
}) {
  const [data, setData] = useState<{
      id: number;
      episodes: Record<string, EpisodeMetadata>;
    }>({ id: 0, episodes: {} }),
    [search, setSearch] = useState(""),
    [numbers, setNumbers] = useState(false),
    [limit, setLimit] = useState(50);
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
  const filtered = Array.from({ length: total }, (_, i) => i + 1).filter(
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
      {numbers ? (
        <EpisodePicker
          anime={anime}
          total={total}
          selected={selected}
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
