import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import AniPmPlayer from "./AniPmPlayer";
import { aniPmUrl, validAniPmState } from "../utils/anipm";
import type { PlayerProps } from "./VideoPlayer";
test("Ani.pm uses explicit episode identity for 80% tracking and cleans up its SDK", async () => {
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const events: Record<string, (data: any) => void> = {};
  const player = {
    iframe: document.createElement("iframe"),
    state: { anilistId: 1, episode: 2, lang: "dub" },
    on: (event: string, cb: (data: any) => void) => {
      events[event] = cb;
    },
    destroy: jest.fn(),
    loadEpisode: jest.fn().mockResolvedValue({}),
  };
  player.iframe.allow = "autoplay; fullscreen; picture-in-picture";
  player.iframe.setAttribute("allowfullscreen", "");
  const original = window.AniPM;
  window.AniPM = {
    Player: jest.fn().mockImplementation(() => player),
  } as unknown as typeof window.AniPM;
  const watched = jest.fn(),
    changed = jest.fn(),
    progress = jest.fn();
  const props = {
    title: "Example",
    episode: 2,
    stream: { name: "Ani.pm (Dub)", url: aniPmUrl(1, 2, "dub") },
    canNext: true,
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onClose: jest.fn(),
    onWatched: watched,
    onEpisodeChange: changed,
    onProgress: progress,
    accounts: { autoSync: true },
  } as unknown as PlayerProps;
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    expect(player.iframe.hasAttribute("allowfullscreen")).toBe(false);
    expect(player.iframe.allow).toContain("fullscreen 'none'");
    expect(player.iframe.allow).toContain("autoplay");
    const dialog = node.querySelector('[role="dialog"]') as HTMLDivElement;
    const requestFullscreen = jest.fn().mockResolvedValue(undefined);
    dialog.requestFullscreen = requestFullscreen;
    const fullscreen = node.querySelector('[aria-label="Fullscreen video"]') as HTMLButtonElement;
    await act(async () => fullscreen.click());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(player.destroy).not.toHaveBeenCalled();
    expect(window.AniPM.Player).toHaveBeenCalledTimes(1);
    requestFullscreen.mockRejectedValueOnce(new Error("Denied by browser"));
    await act(async () => fullscreen.click());
    expect(node.querySelector('[role="alert"]')?.textContent).toContain("Playback can continue here");
    expect(player.destroy).not.toHaveBeenCalled();
    events.ready(player.state);
    expect(changed).toHaveBeenCalledWith(2, "dub");
    events.timeupdate({ currentTime: 79, duration: 100 });
    expect(watched).not.toHaveBeenCalled();
    events.timeupdate({ currentTime: 80, duration: 100 });
    events.timeupdate({ currentTime: 81, duration: 100 });
    expect(watched).toHaveBeenCalledTimes(1);
    expect(watched).toHaveBeenLastCalledWith(2);
    player.state.episode = 3;
    events.episodechange(player.state);
    events.timeupdate({ currentTime: 80, duration: 100 });
    expect(watched).toHaveBeenLastCalledWith(3);
    player.state.anilistId = 99;
    events.timeupdate({ currentTime: 90, duration: 100 });
    expect(watched).toHaveBeenCalledTimes(2);
    expect(validAniPmState({ anilistId: 1, episode: -1, lang: "sub" }, 1)).toBe(
      false,
    );
    act(() => root.unmount());
    expect(player.destroy).toHaveBeenCalled();
  } finally {
    window.AniPM = original;
    node.remove();
  }
});
