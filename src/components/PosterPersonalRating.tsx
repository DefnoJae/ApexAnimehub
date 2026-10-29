import React from "react";
import type { useAccounts } from "../hooks/useAccounts";
import { PersonalRating } from "./RatingPills";
type Accounts = ReturnType<typeof useAccounts>;
type Entry = Accounts["libraryEntries"][number];
const indexes = new WeakMap<Entry[], Map<string, number>>();
export function personalScore(
  entries: Entry[],
  anime: { id?: number; idMal?: number | null } | null | undefined,
) {
  if (!anime) return undefined;
  let index = indexes.get(entries);
  if (!index) {
    index = new Map<string, number>();
    // Consistent with My List: prefer a rated AniList entry, then MAL.
    for (const provider of ["mal", "anilist"])
      for (const entry of entries) {
        if (
          !entry?.anime ||
          entry.provider !== provider ||
          !Number.isFinite(entry.score) ||
          !entry.score ||
          entry.score < 1 ||
          entry.score > 10
        )
          continue;
        const score = Math.round(entry.score);
        if (entry.anime.id) index.set("a" + entry.anime.id, score);
        if (entry.anime.idMal) index.set("m" + entry.anime.idMal, score);
      }
    indexes.set(entries, index);
  }
  return (
    (anime.id && index.get("a" + anime.id)) ||
    (anime.idMal && index.get("m" + anime.idMal)) ||
    undefined
  );
}
export function PosterPersonalRating({
  accounts,
  anime,
}: {
  accounts: Accounts;
  anime?: { id?: number; idMal?: number | null } | null;
}) {
  return (
    <PersonalRating
      score={personalScore(accounts.libraryEntries || [], anime)}
      className="poster-personal-score"
    />
  );
}
