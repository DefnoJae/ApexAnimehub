import { fetchAnilist } from "../utils/anilist";
import { entryChanges } from "../utils/notificationChanges";
import { useLibrary } from "./useLibrary";
import { useNotifications } from "./useNotifications";
import { sameAnime } from "./useLibrary";
import { useCallback, useEffect, useRef, useState } from "react";
export type AccountProvider = "anilist" | "mal";
export type ListStatus =
  | "watching"
  | "planning"
  | "completed"
  | "paused"
  | "dropped";
export interface ListAnime {
  id: number;
  idMal?: number | null;
  episodes?: number | null;
  coverImage?: { extraLarge?: string };
  title?: { english?: string; romaji?: string };
}
export interface AccountResult {
  provider: AccountProvider;
  success: boolean;
  error?: string;
  entry?: { status: ListStatus; progress?: number; score?: number };
}
export interface EntryEdit {
  manualProgress?: boolean;
  scores?: Partial<Record<AccountProvider, number>>;
}
const providers: AccountProvider[] = ["anilist", "mal"];
export async function sendListUpdate(
  provider: AccountProvider,
  anime: ListAnime,
  status: ListStatus,
  progress?: number,
  automatic = false,
  edit?: { manualProgress?: boolean; score?: number },
): Promise<AccountResult> {
  try {
    if (provider === "anilist" && !anime.id)
      throw new Error(
        "This anime has no confirmed AniList match. MyAnimeList can still update independently.",
      );
    if (provider === "mal" && !anime.idMal)
      throw new Error(
        "This anime has no confirmed MyAnimeList ID. Reopen its details and try again.",
      );
    const response = await fetch("/api/list/" + provider, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: provider === "mal" ? anime.idMal : anime.id,
        status,
        ...(progress !== undefined ? { progress } : {}),
        automatic,
        ...(edit?.manualProgress ? { manualProgress: true } : {}),
        ...(edit?.score !== undefined ? { score: edit.score } : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(
        data.error || "List update failed (" + response.status + ")",
      );
    const raw = data.entry;
    const normalized = raw
      ? {
          status:
            (
              {
                CURRENT: "watching",
                REPEATING: "watching",
                PLANNING: "planning",
                COMPLETED: "completed",
                PAUSED: "paused",
                DROPPED: "dropped",
                watching: "watching",
                plan_to_watch: "planning",
                completed: "completed",
                on_hold: "paused",
                dropped: "dropped",
              } as Record<string, ListStatus>
            )[raw.status] || status,
          progress:
            provider === "anilist" ? raw.progress : raw.num_episodes_watched,
          score:
            typeof raw.score === "number"
              ? provider === "anilist"
                ? raw.score / 10
                : raw.score
              : undefined,
        }
      : undefined;
    return {
      provider,
      success: true,
      ...(normalized ? { entry: normalized } : {}),
    };
  } catch (error) {
    return {
      provider,
      success: false,
      error: error instanceof Error ? error.message : "List update failed",
    };
  }
}
export function useAccounts() {
  const [connected, setConnected] = useState<Record<AccountProvider, boolean>>({
    anilist: false,
    mal: false,
  });
  const [configured, setConfigured] = useState<
    Record<AccountProvider, boolean>
  >({ anilist: false, mal: false });
  const library = useLibrary(connected);
  const notificationFeed = useNotifications(
    providers
      .filter((p) => connected[p])
      .map((p) => p + ":" + (library.lists[p]?.identity || "pending"))
      .join("|") || "guest",
  );
  const currentLibrary = useRef(library);
  currentLibrary.current = library;
  const [checking, setChecking] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [loginNotice] = useState(() => {
    const result = new URLSearchParams(window.location.search).get("result");
    return result === "connected"
      ? "Account connected."
      : result === "denied"
        ? "Connection cancelled. You can try again."
        : result === "failed"
          ? "Account connection failed. Please try again."
          : "";
  });
  const [autoSync, setAutoSync] = useState(() => {
    try {
      return localStorage.getItem("apex_auto_sync") !== "false";
    } catch {
      return true;
    }
  });
  const [results, setResults] = useState<AccountResult[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const refresh = useCallback(async () => {
    setChecking(true);
    setAccountError("");
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Account service unavailable");
      const data = await response.json();
      if (!data.providers)
        throw new Error("Account backend is missing from this deployment");
      setConnected({
        anilist: !!data.providers.anilist.connected,
        mal: !!data.providers.mal.connected,
      });
      setConfigured({
        anilist: !!data.providers.anilist.configured,
        mal: !!data.providers.mal.configured,
      });
      if (!data.providers.anilist.configured || !data.providers.mal.configured)
        setAccountError(
          "Some account connections need developer credentials configured by the site owner.",
        );
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Account service unavailable",
      );
    }
    setChecking(false);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const toggleAutoSync = () =>
    setAutoSync((value) => {
      try {
        localStorage.setItem("apex_auto_sync", String(!value));
      } catch {}
      return !value;
    });
  const disconnect = async (provider: AccountProvider) => {
    try {
      const response = await fetch("/api/oauth/" + provider + "/logout", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not disconnect account");
      setConnected((value) => ({ ...value, [provider]: false }));
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Disconnect failed",
      );
    }
  };
  const sync = (
    anime: ListAnime,
    status: ListStatus,
    progress?: number,
    automatic = false,
    edit?: EntryEdit,
  ) => {
    if (automatic && !autoSync) return Promise.resolve([]);
    const enabled = providers.filter(
      (provider) =>
        connected[provider] &&
        (!edit || edit.manualProgress || edit.scores?.[provider] !== undefined),
    );
    if (!enabled.length) {
      if (!automatic)
        notificationFeed.notify({
          kind: "info",
          title: "Connect an account",
          detail:
            "Connect AniList or MyAnimeList in Settings before updating your lists.",
        });
      if (!automatic) {
        setResults([]);
        setMessage("Connect AniList or MyAnimeList in Settings first.");
      }
      return Promise.resolve([]);
    }
    setPending((value) => value + 1);
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        let mapped = anime;
        if (enabled.includes("anilist") && !mapped.id && mapped.idMal) {
          try {
            const data = await fetchAnilist<{ Media: ListAnime }>(
              "query($idMal:Int){Media(idMal:$idMal,type:ANIME){id idMal episodes title{english romaji} coverImage{extraLarge}}}",
              { idMal: mapped.idMal },
            );
            if (data.Media) mapped = { ...mapped, ...data.Media };
          } catch {
            /* A failed AniList match must not block MAL updates. */
          }
        }
        if (enabled.includes("mal") && !mapped.idMal) {
          try {
            const data = await fetchAnilist<{ Media: ListAnime }>(
              "query($id:Int){Media(id:$id,type:ANIME){id idMal episodes title{english romaji} coverImage{extraLarge}}}",
              { id: anime.id },
            );
            if (data.Media) mapped = data.Media;
          } catch {
            /* AniList updates still proceed if MAL mapping lookup fails. */
          }
        }
        const effectiveStatus =
          status === "watching" &&
          progress !== undefined &&
          mapped.episodes &&
          progress >= mapped.episodes
            ? "completed"
            : status;
        const previousEntries = currentLibrary.current.libraryEntries.filter(
          (entry) => sameAnime(entry.anime, mapped),
        );
        const targetStatuses = new Map<AccountProvider, ListStatus>();
        const settled = await Promise.allSettled(
          enabled.map((provider) => {
            let target = effectiveStatus;
            if (edit) {
              target =
                library.libraryEntries.find(
                  (entry) =>
                    entry.provider === provider &&
                    sameAnime(entry.anime, mapped),
                )?.status || status;
              if (progress !== undefined && edit.manualProgress) {
                if (mapped.episodes && progress >= mapped.episodes)
                  target = "completed";
                else if (
                  target === "completed" ||
                  (target === "planning" && progress > 0)
                )
                  target = "watching";
              }
            }
            targetStatuses.set(provider, target);
            return sendListUpdate(
              provider,
              mapped,
              target,
              progress,
              automatic,
              edit
                ? {
                    manualProgress: edit.manualProgress,
                    score: edit.scores?.[provider],
                  }
                : undefined,
            );
          }),
        );
        const next = settled.map(
          (result, i): AccountResult =>
            result.status === "fulfilled"
              ? result.value
              : {
                  provider: enabled[i],
                  success: false,
                  error: String(result.reason),
                },
        );
        next
          .filter((result) => result.success)
          .forEach((result) =>
            library.record(
              result.provider,
              mapped,
              result.entry?.status ||
                targetStatuses.get(result.provider) ||
                effectiveStatus,
              result.entry?.progress ?? progress,
              {
                manualProgress: edit?.manualProgress,
                score: result.entry?.score ?? edit?.scores?.[result.provider],
              },
            ),
          );
        if (next.some((result) => result.success))
          void library.refreshLibrary();
        setResults(next);
        const changes = Array.from(
          new Set(
            next
              .filter((result) => result.success)
              .flatMap((result) => {
                const before = previousEntries.find(
                  (entry) => entry.provider === result.provider,
                );
                return entryChanges(before, {
                  status:
                    result.entry?.status ||
                    targetStatuses.get(result.provider) ||
                    effectiveStatus,
                  progress:
                    result.entry?.progress ??
                    (progress === undefined
                      ? before?.progress || 0
                      : edit?.manualProgress
                        ? progress
                        : Math.max(before?.progress || 0, progress)),
                  score:
                    result.entry?.score ??
                    edit?.scores?.[result.provider] ??
                    before?.score,
                });
              }),
          ),
        );
        if (changes.length || next.some((result) => !result.success)) {
          let poster =
            mapped.coverImage?.extraLarge ||
            previousEntries.find((entry) => entry.anime.coverImage?.extraLarge)
              ?.anime.coverImage?.extraLarge;
          if (!poster && mapped.id) {
            try {
              const data = await fetchAnilist<{
                Media: { coverImage?: { extraLarge?: string } };
              }>(
                "query($id:Int){Media(id:$id,type:ANIME){coverImage{extraLarge}}}",
                { id: mapped.id },
              );
              poster = data.Media?.coverImage?.extraLarge;
            } catch {
              /* Keep the entry notification when artwork is unavailable. */
            }
          }
          notificationFeed.notify({
            kind: next.every((result) => result.success) ? "success" : "error",
            title: next.every((result) => result.success)
              ? "Lists updated"
              : "List update needs attention",
            anime: {
              id: mapped.id,
              idMal: mapped.idMal,
              title: anime.title?.english || anime.title?.romaji || "Anime",
              poster,
            },
            detail:
              (anime.title?.english || anime.title?.romaji || "Anime") +
              "\n" +
              changes.join("\n") +
              "\n" +
              next
                .map(
                  (result) =>
                    (result.provider === "mal" ? "MyAnimeList" : "AniList") +
                    ": " +
                    (result.success ? "Updated" : result.error),
                )
                .join("\n"),
          });
        }
        setMessage(
          (anime.title?.english || anime.title?.romaji || "Anime") +
            ": " +
            effectiveStatus +
            (progress !== undefined
              ? " · watched through episode " + progress
              : ""),
        );
        return next;
      })
      .finally(() => setPending((value) => value - 1));
    queue.current = task;
    return task;
  };
  return {
    notificationFeed,
    ...library,
    connected,
    configured,
    checking,
    accountError,
    loginNotice,
    autoSync,
    toggleAutoSync,
    refresh,
    disconnect,
    sync,
    results,
    message,
    busy: pending > 0,
  };
}
