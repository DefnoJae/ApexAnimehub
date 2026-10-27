import type { Player } from "./anipm-sdk";
export function aniPmUrl(id: number, episode: number, lang: "sub" | "dub") {
  return `https://ani.pm/embed/ani/${id}/${episode}/${lang}?color=b58aff&autoplay=1`;
}
let loading: Promise<void> | undefined;
export function loadAniPmSdk(): Promise<void> {
  if (window.AniPM?.Player) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://ani.pm/embed/sdk/v1.js";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        loading = undefined;
        reject(new Error("Ani.pm timed out. Try another source."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        if (window.AniPM?.Player) resolve();
        else {
          loading = undefined;
          reject(new Error("Ani.pm player unavailable"));
        }
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        loading = undefined;
        reject(new Error("Could not load Ani.pm. Try another source."));
      };
      document.head.append(script);
    });
  return loading;
}
export function validAniPmState(
  state: Pick<Player["state"], "anilistId" | "episode" | "lang">,
  id: number,
) {
  return (
    state.anilistId === id &&
    Number.isSafeInteger(state.episode) &&
    state.episode > 0 &&
    (state.lang === "sub" || state.lang === "dub")
  );
}
