import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountProvider, ListAnime, ListStatus } from "./useAccounts";
export interface LibraryAnime extends ListAnime {
  coverImage?: { extraLarge?: string };
  bannerImage?: string;
}
export interface LibraryEntry {
  anime: LibraryAnime;
  status: ListStatus;
  progress: number;
  updatedAt: number;
}
interface Snapshot {
  identity: string;
  name: string;
  entries: LibraryEntry[];
  updatedAt: number;
}
const providers: AccountProvider[] = ["anilist", "mal"];
export const sameAnime = (a: ListAnime, b: ListAnime) =>
  !!(
    (a.id && b.id && a.id === b.id) ||
    (a.idMal && b.idMal && a.idMal === b.idMal)
  );
export function useLibrary(connected: Record<AccountProvider, boolean>) {
  const [lists, setLists] = useState<
    Partial<Record<AccountProvider, Snapshot>>
  >({});
  const [errors, setErrors] = useState<
    Partial<Record<AccountProvider, string>>
  >({});
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const refreshLibrary = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    setErrors({});
    setLists((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([provider]) => connected[provider as AccountProvider],
        ),
      ),
    );
    await Promise.allSettled(
      providers
        .filter((p) => connected[p])
        .map(async (provider) => {
          try {
            let page = 1,
              identity = "",
              name = "",
              entries: LibraryEntry[] = [];
            for (;;) {
              const response = await fetch(
                "/api/list/" + provider + "?page=" + page,
                { cache: "no-store" },
              );
              const data = await response.json();
              if (!response.ok)
                throw new Error(data.error || "Could not import list");
              if (!Array.isArray(data.entries) || !data.identity)
                throw new Error("Invalid list response");
              if (run !== generation.current) return;
              if (identity && identity !== data.identity)
                throw new Error(
                  "Account changed during import. Refresh your list.",
                );
              identity = data.identity;
              name = data.name;
              if (page === 1) {
                setLists((previous) =>
                  previous[provider]?.identity === identity
                    ? previous
                    : { ...previous, [provider]: undefined },
                );
                // Never read another account's saved library before verifying identity.
                try {
                  const cached = JSON.parse(
                    localStorage.getItem(
                      "apex_library_v1_" + provider + "_" + identity,
                    ) || "null",
                  );
                  if (
                    cached?.identity === identity &&
                    Array.isArray(cached.entries)
                  )
                    setLists((previous) => ({
                      ...previous,
                      [provider]: cached,
                    }));
                } catch {}
              }
              entries.push(...data.entries);
              if (!data.hasNextPage) break;
              page++;
              if (page > 10000)
                throw new Error("List import exceeded page limit");
            }
            const snapshot = { identity, name, entries, updatedAt: Date.now() };
            if (run !== generation.current) return;
            setLists((previous) => ({ ...previous, [provider]: snapshot }));
            try {
              localStorage.setItem(
                "apex_library_v1_" + provider + "_" + identity,
                JSON.stringify(snapshot),
              );
            } catch {}
          } catch (error) {
            if (run === generation.current)
              setErrors((previous) => ({
                ...previous,
                [provider]:
                  error instanceof Error ? error.message : "Import failed",
              }));
          }
        }),
    );
    if (run === generation.current) setLoading(false);
  }, [connected.anilist, connected.mal]);
  useEffect(() => {
    void refreshLibrary();
    return () => {
      generation.current++;
    };
  }, [refreshLibrary]);
  const record = (
    provider: AccountProvider,
    anime: ListAnime,
    status: ListStatus,
    progress?: number,
  ) => {
    setLists((previous) => {
      const list = previous[provider];
      if (!list) return previous;
      const existing = list.entries.find((e) => sameAnime(e.anime, anime));
      const entry = {
        anime: { ...existing?.anime, ...anime },
        status,
        progress: Math.max(existing?.progress || 0, progress || 0),
        updatedAt: Date.now(),
      };
      const next = {
        ...list,
        entries: [
          ...list.entries.filter((e) => !sameAnime(e.anime, anime)),
          entry,
        ],
      };
      try {
        localStorage.setItem(
          "apex_library_v1_" + provider + "_" + list.identity,
          JSON.stringify(next),
        );
      } catch {}
      return { ...previous, [provider]: next };
    });
  };
  const entries = providers
    .filter((p) => connected[p])
    .flatMap((provider) =>
      (lists[provider]?.entries || []).map((entry) => ({ ...entry, provider })),
    );
  return {
    lists,
    libraryEntries: entries,
    libraryErrors: errors,
    libraryLoading: loading,
    refreshLibrary,
    record,
    getListStatus: (anime: ListAnime) =>
      entries.find((entry) => sameAnime(entry.anime, anime))?.status,
  };
}

