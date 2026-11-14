import { useCallback, useEffect, useRef, useState } from "react";

export type AudioLanguage = "sub" | "dub";
export type PlaybackSource = "anipm" | "apex" | "megaplay" | "animeembed";
export function preferredPlaybackSource(): PlaybackSource {
  try {
    const source = localStorage.getItem("apex_playback_source");
    if (source === "apex" || source === "megaplay" || source === "animeembed") return source;
  } catch {}
  return "anipm";
}
export interface PageRoute {
  view:
    | "all"
    | "discover"
    | "my-list"
    | "dub-releases"
    | "details"
    | "not-found";
  studioId?: number;
  studioName?: string;
  animeId?: number;
  episode?: number;
  play?: boolean;
  audio: AudioLanguage;
  source: PlaybackSource;
}
export const sectionPaths: Record<string, string> = {
  all: "/",
  discover: "/discover",
  "my-list": "/my-list",
  "dub-releases": "/calendar",
};
const positiveId = (value: string | null) =>
  value &&
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0
    ? Number(value)
    : undefined;
export function parsePageRoute(pathname: string, search = ""): PageRoute {
  const params = new URLSearchParams(search);
  const audio = params.get("audio") === "dub" ? "dub" : "sub";
  const requested = params.get("source");
  const source =
    requested === "megaplay" || requested === "apex" || requested === "animeembed" ? requested : "anipm";
  const path = pathname.replace(/\/+$/, "") || "/";
  const section = Object.entries(sectionPaths).find(([, url]) => url === path);
  if (section || path === "/home")
    return {
      view: (section?.[0] || "all") as PageRoute["view"],
      studioId:
        path === "/discover" ? positiveId(params.get("studio")) : undefined,
      studioName:
        path === "/discover"
          ? params.get("studioName") || undefined
          : undefined,
      audio,
      source,
    };
  const match = path.match(/^\/anime\/(\d+)(?:\/episode\/(\d+))?$/);
  const animeId = positiveId(match?.[1] || null);
  const episode = positiveId(match?.[2] || params.get("episode"));
  if (
    match &&
    animeId &&
    (!match[2] || episode) &&
    (!params.has("episode") || episode)
  )
    return {
      view: "details",
      animeId,
      episode,
      play: !!match[2],
      audio,
      source,
    };
  return { view: "not-found", audio, source };
}
export function animePage(id: number, episode?: number) {
  return `/anime/${id}${episode && episode > 1 ? `?episode=${episode}` : ""}`;
}
export function episodePage(
  id: number,
  episode: number,
  audio: AudioLanguage = "sub",
  source: PlaybackSource = "anipm",
) {
  return `/anime/${id}/episode/${episode}?audio=${audio}&source=${source}`;
}
const readRoute = () =>
  parsePageRoute(window.location.pathname, window.location.search);
export function usePageRoute() {
  const [route, setRoute] = useState(readRoute);
  const closingPlayer = useRef(false);
  useEffect(() => {
    if (typeof window.history.state?.apexIndex !== "number")
      window.history.replaceState(
        { ...window.history.state, apexIndex: 0 },
        "",
        window.location.href,
      );
    const pop = () => {
      closingPlayer.current = false;
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const navigate = useCallback((href: string, replace = false) => {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (
      url.pathname + url.search ===
      window.location.pathname + window.location.search
    )
      return;
    const current = readRoute();
    const next = parsePageRoute(url.pathname, url.search);
    const state = window.history.state;
    const index = Number(state?.apexIndex) || 0;
    const samePlayer =
      current.play && next.play && current.animeId === next.animeId;
    const replaceEntry = replace || samePlayer;
    const fromDetails =
      next.play &&
      (samePlayer
        ? state?.apexPlayerFromDetails === true
        : !replaceEntry &&
          current.view === "details" &&
          !current.play &&
          current.animeId === next.animeId);
    window.history[replaceEntry ? "replaceState" : "pushState"](
      {
        apexIndex: replaceEntry ? index : index + 1,
        apexPlayerFromDetails: fromDetails,
      },
      "",
      url.pathname + url.search,
    );
    setRoute(readRoute());
    window.scrollTo({ top: 0 });
  }, []);
  const back = useCallback(
    (fallback = "/") => {
      if (window.history.state?.apexIndex > 0) window.history.back();
      else navigate(fallback, true);
    },
    [navigate],
  );
  const closePlayer = useCallback(
    (detailsHref: string) => {
      if (closingPlayer.current || !readRoute().play) return;
      if (
        window.history.state?.apexPlayerFromDetails === true &&
        window.history.state.apexIndex > 0
      ) {
        closingPlayer.current = true;
        window.history.back();
      } else {
        navigate(detailsHref, true);
      }
    },
    [navigate],
  );
  return { route, navigate, back, closePlayer };
}
