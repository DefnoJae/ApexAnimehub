import React from "react";
import { Check } from "lucide-react";
import type { ListAnime, AccountProvider } from "../hooks/useAccounts";
import { sameAnime, LibraryEntry } from "../hooks/useLibrary";
export function EpisodePicker({
  anime,
  total,
  selected,
  entries,
  importing,
  onSelect,
  episodeNumbers,
}: {
  anime: ListAnime;
  total: number;
  selected: number;
  entries: Array<LibraryEntry & { provider: AccountProvider }>;
  importing: boolean;
  onSelect: (episode: number) => void;
  episodeNumbers?: number[];
}) {
  const matches = entries.filter((entry) => sameAnime(entry.anime, anime));
  const progress = Math.min(
    total,
    Math.max(
      0,
      ...matches.map((entry) =>
        Number.isFinite(entry.progress) ? entry.progress : 0,
      ),
    ),
  );
  return (
    <section className="episode-picker" aria-label="Episodes">
      <h3>Episodes ({episodeNumbers?.length ?? total})</h3>
      <p className="episode-progress-summary">
        {progress
          ? "Watched through episode " + progress
          : importing
            ? "Importing watch progress from your lists…"
            : "No watched episodes recorded in your connected lists."}
        {matches.length > 0 && (
          <span>
            {matches
              .map(
                (entry) =>
                  (entry.provider === "mal" ? "MAL" : "AniList") +
                  ": " +
                  entry.progress,
              )
              .join(" · ")}
          </span>
        )}
      </p>
      <div className="episode-grid">
        {(episodeNumbers || Array.from({ length: total }, (_, i) => i + 1)).map(
          (episode) => {
            const watched = episode <= progress;
            return (
              <button
                key={episode}
                className={
                  "episode-cell" +
                  (watched ? " is-watched" : "") +
                  (episode === selected ? " is-selected" : "")
                }
                aria-label={
                  "Episode " +
                  episode +
                  (watched ? ", watched" : ", not marked watched")
                }
                aria-pressed={episode === selected}
                title={watched ? "Watched on your list" : "Not marked watched"}
                onClick={() => onSelect(episode)}
              >
                {episode}
                {watched && <Check size={13} aria-hidden="true" />}
              </button>
            );
          },
        )}
      </div>
    </section>
  );
}
