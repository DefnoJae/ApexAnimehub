import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountProvider, ListAnime, ListStatus } from "./useAccounts";
export interface LibraryAnime extends ListAnime {
  coverImage?: { extraLarge?: string };
  bannerImage?: string;
  averageScore?: number;
  malScore?: number | null;
}
export interface LibraryEntry {
  anime: LibraryAnime;
  status: ListStatus;
  progress: number;
  score?: number;
  updatedAt: number;
}
interface Snapshot {
  complete?: boolean;
  nextPage?: number;
  identity: string;
  name: string;
  entries: LibraryEntry[];
  updatedAt: number;
}
const providers: AccountProvider[] = ["anilist", "mal"];
interface ConfirmedChange {
  anime: ListAnime;
  entry?: LibraryEntry;
  savedAt: number;
}
const changeKey = (provider: AccountProvider, identity: string) =>
  "apex_library_changes_v1_" + provider + "_" + identity;
function readChanges(
  provider: AccountProvider,
  identity: string,
): ConfirmedChange[] {
  try {
    const data = JSON.parse(
      localStorage.getItem(changeKey(provider, identity)) || "[]",
    );
    return Array.isArray(data)
      ? data.filter(
          (change) =>
            change &&
            change.anime &&
            (change.anime.id > 0 || change.anime.idMal > 0) &&
            Number.isFinite(change.savedAt) &&
            Date.now() - change.savedAt < 86400000 &&
            (!change.entry ||
              ([
                "planning",
                "watching",
                "completed",
                "paused",
                "dropped",
              ].includes(change.entry.status) &&
                Number.isFinite(change.entry.progress))),
        )
      : [];
  } catch {
    return [];
  }
}
function saveChanges(
  provider: AccountProvider,
  identity: string,
  changes: ConfirmedChange[],
) {
  try {
    localStorage.setItem(
      changeKey(provider, identity),
      JSON.stringify(changes),
    );
  } catch {}
}
export function mergeConfirmed(
  entries: LibraryEntry[],
  changes: ConfirmedChange[],
) {
  return changes.reduce((merged, change) => {
    const filtered = merged.filter(
      (entry) => !sameAnime(entry.anime, change.anime),
    );
    return change.entry ? [...filtered, change.entry] : filtered;
  }, entries);
}

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
  const changes = useRef(new Map<string, ConfirmedChange[]>());
  const confirmed = useCallback(
    (provider: AccountProvider, identity: string) => {
      const key = changeKey(provider, identity);
      if (!changes.current.has(key))
        changes.current.set(key, readChanges(provider, identity));
      return changes.current.get(key)!;
    },
    [],
  );
  const remember = (
    provider: AccountProvider,
    identity: string,
    change: ConfirmedChange,
  ) => {
    const next = [
      ...confirmed(provider, identity).filter(
        (item) => !sameAnime(item.anime, change.anime),
      ),
      change,
    ];
    changes.current.set(changeKey(provider, identity), next);
    saveChanges(provider, identity, next);
  };
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
                  ) {
                    setLists((previous) => ({
                      ...previous,
                      [provider]:
                        previous[provider]?.identity === identity
                          ? previous[provider]
                          : {
                              ...cached,
                              entries: mergeConfirmed(
                                cached.entries,
                                confirmed(provider, identity),
                              ),
                            },
                    }));
                    if (
                      cached.complete === false &&
                      confirmed(provider, identity).length === 0 &&
                      Number.isSafeInteger(cached.nextPage) &&
                      cached.nextPage > 1 &&
                      cached.nextPage <= 10000 &&
                      Date.now() - cached.updatedAt < 3600000
                    ) {
                      entries = cached.entries;
                      page = cached.nextPage;
                      continue;
                    }
                  }
                } catch {}
              }
              entries.push(...data.entries);
              const partial = {
                identity,
                name,
                entries: mergeConfirmed(entries, confirmed(provider, identity)),
                updatedAt: Date.now(),
                complete: !data.hasNextPage,
                nextPage: page + 1,
              };
              setLists((previous) => {
                const current = previous[provider];
                const next =
                  current?.identity === identity
                    ? {
                        ...partial,
                        complete: current.complete || partial.complete,
                        entries: mergeConfirmed(
                          [
                            ...current.entries.filter(
                              (entry) =>
                                !partial.entries.some((fresh) =>
                                  sameAnime(entry.anime, fresh.anime),
                                ),
                            ),
                            ...partial.entries,
                          ],
                          confirmed(provider, identity),
                        ),
                      }
                    : {
                        ...partial,
                        entries: mergeConfirmed(
                          partial.entries,
                          confirmed(provider, identity),
                        ),
                      };
                try {
                  localStorage.setItem(
                    "apex_library_v1_" + provider + "_" + identity,
                    JSON.stringify(next),
                  );
                } catch {}
                return { ...previous, [provider]: next };
              });
              if (!data.hasNextPage) break;
              await new Promise((resolve) => setTimeout(resolve, 2200));
              if (run !== generation.current) return;
              page++;
              if (page > 10000)
                throw new Error("List import exceeded page limit");
            }
            if (run !== generation.current) return;
            const outstanding = confirmed(provider, identity).filter(
              (change) => {
                const entry = entries.find((entry) =>
                  sameAnime(entry.anime, change.anime),
                );
                return change.entry
                  ? !entry ||
                      entry.status !== change.entry.status ||
                      entry.progress !== change.entry.progress ||
                      (change.entry.score !== undefined &&
                        entry.score !== change.entry.score)
                  : !!entry;
              },
            );
            changes.current.set(changeKey(provider, identity), outstanding);
            saveChanges(provider, identity, outstanding);
            const snapshot = {
              identity,
              name,
              entries: mergeConfirmed(entries, confirmed(provider, identity)),
              updatedAt: Date.now(),
              complete: true,
            };
            if (run !== generation.current) return;
            setLists((previous) => ({
              ...previous,
              [provider]: {
                ...snapshot,
                entries: mergeConfirmed(
                  snapshot.entries,
                  confirmed(provider, identity),
                ),
              },
            }));
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
  }, [connected.anilist, connected.mal, confirmed]);
  useEffect(() => {
    void refreshLibrary();
    return () => {
      generation.current++;
    };
  }, [refreshLibrary]);
  useEffect(() => {
    if (!Object.values(errors).some((error) => error?.includes("429"))) return;
    const timer = window.setTimeout(() => void refreshLibrary(), 65000);
    return () => window.clearTimeout(timer);
  }, [errors, refreshLibrary]);
  const record = (
    provider: AccountProvider,
    anime: ListAnime,
    status: ListStatus,
    progress?: number,
    edit?: { manualProgress?: boolean; score?: number },
  ) => {
    setLists((previous) => {
      const list = previous[provider];
      if (!list) return previous;
      const existing = list.entries.find((e) => sameAnime(e.anime, anime));
      const entry = {
        anime: { ...existing?.anime, ...anime },
        status,
        progress:
          progress === undefined
            ? existing?.progress || 0
            : edit?.manualProgress
              ? progress
              : Math.max(existing?.progress || 0, progress),
        score: edit?.score !== undefined ? edit.score : existing?.score,
        updatedAt: Date.now(),
      };
      remember(provider, list.identity, { anime, entry, savedAt: Date.now() });
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
    removeRecord: (provider: AccountProvider, anime: ListAnime) =>
      setLists((previous) => {
        const list = previous[provider];
        if (!list) return previous;
        remember(provider, list.identity, { anime, savedAt: Date.now() });
        const next = {
          ...list,
          entries: list.entries.filter(
            (entry) => !sameAnime(entry.anime, anime),
          ),
        };
        try {
          localStorage.setItem(
            "apex_library_v1_" + provider + "_" + list.identity,
            JSON.stringify(next),
          );
        } catch {}
        return { ...previous, [provider]: next };
      }),
    getListStatus: (anime: ListAnime) =>
      entries.find((entry) => sameAnime(entry.anime, anime))?.status,
  };
}
