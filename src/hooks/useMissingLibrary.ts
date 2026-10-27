import { useEffect, useRef, useState } from "react";
import type { useAccounts } from "./useAccounts";
import type { DashboardAnime } from "../components/HomeDashboard";
import { fetchMissingLibrary, libraryIdentity } from "../utils/homeRows";
import { sameAnime } from "./useLibrary";

export function useMissingLibrary(accounts: ReturnType<typeof useAccounts>) {
  const library = accounts.libraryEntries || [];
  const identity = libraryIdentity(library.map((entry) => entry.anime));
  const failed = Object.keys(accounts.libraryErrors || {}).length > 0;
  const connected = !!(accounts.connected?.anilist || accounts.connected?.mal);
  const importing = !!(accounts.checking || accounts.libraryLoading);
  const current = useRef(library);
  current.current = library;
  const [state, setState] = useState<{
    key: string;
    animes: DashboardAnime[];
    loading: boolean;
    error?: string;
  }>({ key: "", animes: [], loading: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!connected || importing || failed || !identity) return;
    const abort = new AbortController();
    setState({ key: identity, animes: [], loading: true });
    void fetchMissingLibrary(
      current.current.map((entry) => entry.anime),
      abort.signal,
    )
      .then((result) => {
        if (!abort.signal.aborted)
          setState({ key: identity, ...result, loading: false });
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setState({
            key: identity,
            animes: [],
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Missing titles could not load.",
          });
      });
    return () => abort.abort();
  }, [identity, connected, importing, failed, attempt]);
  let notice: string | undefined;
  if (!connected)
    notice =
      "Connect AniList or MyAnimeList to find anime missing from your library.";
  else if (importing) notice = "Importing your connected lists…";
  else if (failed)
    notice = "Refresh your connected lists to find missing titles accurately.";
  else if (!identity)
    notice =
      "Add anime to your lists to find connected seasons, specials and side stories.";
  else if (state.key !== identity || state.loading)
    notice = "Finding connected anime missing from your lists…";
  else if (state.error) notice = state.error;
  else if (!state.animes.length)
    notice = "No missing connected anime found in your imported lists.";
  return {
    animes:
      connected && !importing && !failed && state.key === identity
        ? state.animes.filter(
            (anime) => !library.some((entry) => sameAnime(entry.anime, anime)),
          )
        : [],
    notice,
    error: failed || !!state.error,
    retry: () => {
      if (failed) void accounts.refreshLibrary();
      else setAttempt((value) => value + 1);
    },
    connected,
  };
}
