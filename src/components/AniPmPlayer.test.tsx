import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import AniPmPlayer from "./AniPmPlayer";
import { aniPmUrl, validAniPmState } from "../utils/anipm";
import { fetchEpisodeMetadata } from "../utils/episodeMetadata";
import type { PlayerProps } from "./VideoPlayer";

jest.mock("../utils/episodeMetadata", () => ({
  ...jest.requireActual("../utils/episodeMetadata"),
  fetchEpisodeMetadata: jest.fn(),
}));

const fetchMetadata = fetchEpisodeMetadata as jest.MockedFunction<
  typeof fetchEpisodeMetadata
>;
const originalScrollTo = HTMLElement.prototype.scrollTo;
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  fetchMetadata.mockReset();
  fetchMetadata.mockResolvedValue({});
  HTMLElement.prototype.scrollTo = jest.fn() as unknown as typeof HTMLElement.prototype.scrollTo;
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
  }) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  HTMLElement.prototype.scrollTo = originalScrollTo;
  window.matchMedia = originalMatchMedia;
});

test("Ani.pm uses explicit episode identity for 80% tracking and cleans up its SDK", async () => {
  localStorage.clear();
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
  player.iframe.allow = "autoplay; fullscreen";
  window.AniPM = {
    Player: jest.fn().mockImplementation((mount: HTMLElement) => {
      expect(mount.isConnected).toBe(false);
      mount.appendChild(player.iframe);
      return player;
    }),
  } as unknown as typeof window.AniPM;
  const watched = jest.fn(),
    changed = jest.fn(),
    progress = jest.fn(),
    completed = jest.fn();
  const props = {
    title: "Example",
    episode: 2,
    stream: { name: "Ani.pm (Dub)", url: aniPmUrl(1, 2, "dub") },
    canNext: true,
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onClose: jest.fn(),
    onWatched: watched,
    onCompleted: completed,
    onEpisodeChange: changed,
    onProgress: progress,
    accounts: { autoSync: true },
  } as unknown as PlayerProps;
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    expect(player.iframe.hasAttribute("allowfullscreen")).toBe(false);
    expect(player.iframe.allow).toContain("fullscreen 'none'");
    expect(player.iframe.allow).toContain("autoplay");
    expect(player.iframe.isConnected).toBe(true);
    const dialog = node.querySelector('[role="dialog"]') as HTMLDivElement;
    const requestFullscreen = jest.fn().mockResolvedValue(undefined);
    dialog.requestFullscreen = requestFullscreen;
    const fullscreen = node.querySelector(
      '[aria-label="Fullscreen video"]',
    ) as HTMLButtonElement;
    await act(async () => fullscreen.click());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(player.destroy).not.toHaveBeenCalled();
    expect(window.AniPM.Player).toHaveBeenCalledTimes(1);
    requestFullscreen.mockRejectedValueOnce(new Error("Denied by browser"));
    await act(async () => fullscreen.click());
    expect(node.querySelector('[role="alert"]')?.textContent).toContain(
      "Playback can continue here",
    );
    expect(player.destroy).not.toHaveBeenCalled();
    events.ready(player.state);
    expect(changed).toHaveBeenCalledWith(2, "dub");
    events.timeupdate({ currentTime: 79, duration: 100 });
    expect(watched).not.toHaveBeenCalled();
    events.timeupdate({ currentTime: 80, duration: 100 });
    events.timeupdate({ currentTime: 81, duration: 100 });
    expect(watched).toHaveBeenCalledTimes(1);
    expect(watched).toHaveBeenLastCalledWith(2);
    events.ended(player.state);
    events.ended(player.state);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledWith(2);
    expect(watched).toHaveBeenCalledTimes(1);
    player.state.anilistId = 99;
    player.state.episode = 4;
    events.ended(player.state);
    expect(completed).toHaveBeenCalledTimes(1);
    player.state.anilistId = 1;
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

test("resume prompt sends saved time to Ani.pm, suppresses startup zero, and flushes the latest position", async () => {
  localStorage.clear();
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const events: Record<string, (data: any) => void> = {};
  const player = {
    iframe: document.createElement("iframe"),
    state: { anilistId: 9, episode: 2, lang: "sub" },
    on: (name: string, cb: (data: any) => void) => {
      events[name] = cb;
    },
    destroy: jest.fn(),
    loadEpisode: jest.fn().mockResolvedValue({}),
  };
  const original = window.AniPM;
  player.iframe.allow = "autoplay; fullscreen";
  window.AniPM = {
    Player: jest.fn().mockImplementation((mount: HTMLElement) => {
      mount.appendChild(player.iframe);
      return player;
    }),
  } as unknown as typeof window.AniPM;
  const progress = jest.fn();
  const props = {
    title: "Resume anime",
    episode: 2,
    stream: { name: "Ani.pm", url: aniPmUrl(9, 2, "sub") },
    resume: { position: 74, duration: 1440 },
    accounts: { autoSync: true },
    onProgress: progress,
    onWatched: jest.fn(),
    onClose: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    canNext: true,
  } as unknown as PlayerProps;
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    expect(node.textContent).toContain("Continue from 1:14");
    expect(window.AniPM.Player).not.toHaveBeenCalled();
    await act(async () =>
      Array.from(node.querySelectorAll("button"))
        .find((b) => b.textContent?.includes("Continue from"))!
        .click(),
    );
    expect(window.AniPM.Player).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ start: 74, autoplay: true }),
    );
    events.timeupdate({ currentTime: 0, duration: 1440 });
    expect(progress).not.toHaveBeenCalled();
    events.timeupdate({ currentTime: 75, duration: 1440 });
    events.timeupdate({ currentTime: 78, duration: 1440 });
    events.pause(player.state);
    expect(progress).toHaveBeenLastCalledWith(78, 1440, 2);
    act(() => root.unmount());
    expect(
      JSON.parse(localStorage.getItem("apex_episode_progress_v1")!)["9:2"]
        .position,
    ).toBe(78);
  } finally {
    window.AniPM = original;
    node.remove();
    localStorage.clear();
  }
});
test("start from beginning resets the saved position without carrying it into another episode", async () => {
  localStorage.clear();
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const original = window.AniPM;
  const events: Record<string, (data: unknown) => void> = {};
  const onProgress = jest.fn();
  const player = {
    iframe: document.createElement("iframe"),
    state: { anilistId: 8, episode: 1, lang: "sub" },
    on: (event: string, callback: (data: unknown) => void) => {
      events[event] = callback;
    },
    seek: jest.fn().mockResolvedValue({ currentTime: 0 }),
    destroy: jest.fn(),
    loadEpisode: jest.fn().mockResolvedValue({}),
  };
  player.iframe.allow = "autoplay; fullscreen";
  window.AniPM = {
    Player: jest.fn().mockImplementation((mount: HTMLElement) => {
      mount.appendChild(player.iframe);
      return player;
    }),
  } as unknown as typeof window.AniPM;
  const props = {
    title: "Restart anime",
    episode: 1,
    stream: { name: "Ani.pm", url: aniPmUrl(8, 1, "sub") },
    resume: { position: 100, duration: 1400 },
    onProgress,
    accounts: { autoSync: false },
    onWatched: jest.fn(),
    onClose: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    canNext: true,
  } as unknown as PlayerProps;
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    await act(async () =>
      Array.from(node.querySelectorAll("button"))
        .find((b) => b.textContent === "Start from the beginning")!
        .click(),
    );
    expect(window.AniPM.Player).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ start: 0 }),
    );
    await act(async () =>
      events.timeupdate({ currentTime: 100, duration: 1400 }),
    );
    expect(player.seek).toHaveBeenCalledWith(0);
    expect(onProgress.mock.calls).toEqual([[0, 1400, 1]]);
    await act(async () =>
      root.render(
        <AniPmPlayer
          {...props}
          episode={2}
          resume={undefined}
          stream={{ ...props.stream, url: aniPmUrl(8, 2, "sub") }}
        />,
      ),
    );
    expect(player.loadEpisode).toHaveBeenCalledWith(2, {
      lang: "sub",
      start: 0,
    });
    act(() => root.unmount());
  } finally {
    window.AniPM = original;
    node.remove();
    localStorage.clear();
  }
});

test("fullscreen cycles preserve the frame, and an unresponsive frame can reload at its exact last position", async () => {
  localStorage.clear();
  jest.useFakeTimers();
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const original = window.AniPM;
  const events: Record<string, (data: any) => void> = {};
  const players: any[] = [];
  const construct = jest.fn().mockImplementation((mount: HTMLElement) => {
    const player = {
      iframe: document.createElement("iframe"),
      state: { anilistId: 7, episode: 2, lang: "dub", currentTime: 1200 },
      on: (event: string, cb: (data: any) => void) => {
        events[event] = cb;
      },
      destroy: jest.fn(),
      togglePlay: jest.fn().mockResolvedValue({}),
      seekBy: jest.fn().mockResolvedValue({}),
      getState: jest
        .fn()
        .mockResolvedValue({ anilistId: 7, episode: 2, lang: "dub" }),
      loadEpisode: jest.fn(),
    };
    player.iframe.allow = "autoplay; fullscreen";
    mount.append(player.iframe);
    players.push(player);
    return player;
  });
  window.AniPM = { Player: construct } as unknown as typeof window.AniPM;
  const watched = jest.fn();
  const props = {
    title: "Recovery",
    episode: 2,
    stream: { url: aniPmUrl(7, 2, "dub"), name: "Ani.pm" },
    accounts: { autoSync: true },
    onWatched: watched,
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onClose: jest.fn(),
    canNext: true,
  } as unknown as PlayerProps;
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    const dialog = node.querySelector(
      '[aria-label="Anime video player"]',
    ) as HTMLElement;
    const frame = players[0].iframe;
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(construct).toHaveBeenCalledTimes(1);
    expect(frame.isConnected).toBe(true);
    expect(document.activeElement).toBe(dialog);
    const fullscreen = node.querySelector(
      '[aria-label="Fullscreen video"]',
    ) as HTMLElement;
    fullscreen.focus();
    await act(async () =>
      fullscreen.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(players[0].togglePlay).toHaveBeenCalledTimes(1);
    await act(async () =>
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(players[0].seekBy).toHaveBeenCalledWith(-10);
    act(() => events.timeupdate({ currentTime: 1200, duration: 1440 }));
    expect(watched).toHaveBeenCalledTimes(1);
    players[0].getState.mockRejectedValue(new Error("timeout"));
    await act(async () => jest.advanceTimersByTime(20000));
    await act(async () => jest.advanceTimersByTime(20000));
    const retry = Array.from(node.querySelectorAll("button")).find(
      (button) => button.textContent === "Reload player",
    )!;
    expect(retry).toBeDefined();
    await act(async () => retry.click());
    expect(construct).toHaveBeenCalledTimes(2);
    expect(construct.mock.calls[1][1]).toMatchObject({
      anime: 7,
      episode: 2,
      lang: "dub",
      start: 1200,
    });
    expect(players[0].destroy).toHaveBeenCalledTimes(1);
    act(() => events.timeupdate({ currentTime: 1201, duration: 1440 }));
    expect(watched).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  } finally {
    window.AniPM = original;
    node.remove();
    jest.useRealTimers();
    localStorage.clear();
  }
});

test("Ani.pm shows the Apex Player carousel from a button left of SignSync", async () => {
  localStorage.clear();
  fetchMetadata.mockResolvedValue({
    2: { title: "Episode 2" },
    3: { title: "The Rookie", image: "/ep3.jpg" },
  });
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
    seekBy: jest.fn().mockResolvedValue({}),
  };
  player.iframe.allow = "autoplay; fullscreen";
  const original = window.AniPM;
  window.AniPM = {
    Player: jest.fn().mockImplementation((mount: HTMLElement) => {
      mount.appendChild(player.iframe);
      return player;
    }),
  } as unknown as typeof window.AniPM;
  const props = {
    title: "Example",
    episode: 2,
    episodeCount: 3,
    watchedThrough: 2,
    stream: { name: "Ani.pm (Dub)", url: aniPmUrl(1, 2, "dub") },
    canNext: true,
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onClose: jest.fn(),
    onWatched: jest.fn(),
    onCompleted: jest.fn(),
    onEpisodeChange: jest.fn(),
    onProgress: jest.fn(),
    accounts: { autoSync: true },
  } as unknown as PlayerProps;
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    const buttons = Array.from(node.querySelectorAll("button"));
    const episodesButton = buttons.find(
      (button) => button.getAttribute("aria-label") === "Episodes",
    )!;
    const syncButton = buttons.find(
      (button) =>
        button.getAttribute("aria-label") === "SignSync subtitle tools",
    )!;
    expect(episodesButton).toBeDefined();
    expect(syncButton).toBeDefined();
    expect(buttons.indexOf(episodesButton)).toBe(buttons.indexOf(syncButton) - 1);

    await act(async () => episodesButton.click());
    const panel = node.querySelector(
      'section[aria-label="Episodes"]',
    ) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
    expect(fetchMetadata).toHaveBeenCalledWith(1, 3);
    expect(
      node.querySelector('[aria-label="Episode 3 · The Rookie"]'),
    ).not.toBeNull();
    expect(
      node.querySelector('[aria-label="Episode 2, watched"]'),
    ).not.toBeNull();
    expect(node.querySelectorAll(".apex-carousel-card")).toHaveLength(3);
    act(() => root.unmount());
  } finally {
    window.AniPM = original;
    node.remove();
    localStorage.clear();
  }
});

test("Ani.pm overlay closes on X/Escape, ignores player shortcuts, and preserves the resume prompt", async () => {
  localStorage.clear();
  fetchMetadata.mockResolvedValue({});
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const original = window.AniPM;
  const player = {
    iframe: document.createElement("iframe"),
    state: { anilistId: 9, episode: 2, lang: "sub" },
    on: jest.fn(),
    destroy: jest.fn(),
    loadEpisode: jest.fn().mockResolvedValue({}),
    seekBy: jest.fn().mockResolvedValue({}),
  };
  player.iframe.allow = "autoplay; fullscreen";
  window.AniPM = {
    Player: jest.fn().mockImplementation((mount: HTMLElement) => {
      mount.appendChild(player.iframe);
      return player;
    }),
  } as unknown as typeof window.AniPM;
  const changed = jest.fn();
  const props = {
    title: "Resume anime",
    episode: 2,
    episodeCount: 3,
    watchedThrough: 1,
    stream: { name: "Ani.pm", url: aniPmUrl(9, 2, "sub") },
    resume: { position: 50, duration: 100 },
    accounts: { autoSync: true },
    onEpisodeChange: changed,
    onProgress: jest.fn(),
    onWatched: jest.fn(),
    onClose: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    canNext: true,
  } as unknown as PlayerProps;
  const openEpisodes = async () => {
    const button = Array.from(node.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Episodes",
    )!;
    await act(async () => button.click());
  };
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    const dialog = node.querySelector('[role="dialog"]') as HTMLDivElement;
    expect(node.textContent).toContain("Continue from 0:50");
    expect(window.AniPM.Player).not.toHaveBeenCalled();

    await act(async () => openEpisodes());
    const panel = node.querySelector(
      'section[aria-label="Episodes"]',
    ) as HTMLElement;
    expect(document.activeElement).toBe(panel);
    await act(async () =>
      panel.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(player.seekBy).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();

    await act(async () =>
      panel.dispatchEvent(
        new KeyboardEvent("keydown", { key: "x", bubbles: true }),
      ),
    );
    expect(node.querySelector('section[aria-label="Episodes"]')).toBeNull();
    expect(document.activeElement).toBe(dialog);

    await act(async () => openEpisodes());
    const reopened = node.querySelector(
      'section[aria-label="Episodes"]',
    ) as HTMLElement;
    await act(async () =>
      reopened.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(node.querySelector('section[aria-label="Episodes"]')).toBeNull();
    expect(document.activeElement).toBe(dialog);
    expect(node.textContent).toContain("Continue from 0:50");
    expect(window.AniPM.Player).not.toHaveBeenCalled();
    act(() => root.unmount());
  } finally {
    window.AniPM = original;
    node.remove();
    localStorage.clear();
  }
});

test("Ani.pm episode selection flushes progress and loads the chosen episode without remounting", async () => {
  localStorage.clear();
  fetchMetadata.mockResolvedValue({ 3: { title: "The Rookie" } });
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
  player.iframe.allow = "autoplay; fullscreen";
  const original = window.AniPM;
  window.AniPM = {
    Player: jest.fn().mockImplementation((mount: HTMLElement) => {
      mount.appendChild(player.iframe);
      return player;
    }),
  } as unknown as typeof window.AniPM;
  const onProgress = jest.fn();
  const changed = jest.fn();
  const props = {
    title: "Example",
    episode: 2,
    episodeCount: 4,
    watchedThrough: 2,
    stream: { name: "Ani.pm (Dub)", url: aniPmUrl(1, 2, "dub") },
    accounts: { autoSync: true },
    onProgress,
    onEpisodeChange: changed,
    onWatched: jest.fn(),
    onCompleted: jest.fn(),
    onClose: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    canNext: true,
  } as unknown as PlayerProps;
  const openEpisodes = async () => {
    const button = Array.from(node.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Episodes",
    )!;
    await act(async () => button.click());
  };
  try {
    await act(async () => root.render(<AniPmPlayer {...props} />));
    await act(async () => events.ready(player.state));
    await act(async () => events.timeupdate({ currentTime: 1, duration: 100 }));
    await act(async () => events.timeupdate({ currentTime: 42, duration: 100 }));
    expect(
      JSON.parse(localStorage.getItem("apex_episode_progress_v1")!)["1:2"]
        .position,
    ).toBe(1);

    await act(async () => openEpisodes());
    await act(async () =>
      node
        .querySelector('[aria-label="Episode 3 · The Rookie"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );

    expect(onProgress).toHaveBeenLastCalledWith(42, 100, 2);
    expect(
      JSON.parse(localStorage.getItem("apex_episode_progress_v1")!)["1:2"]
        .position,
    ).toBe(42);
    expect(changed).toHaveBeenCalledWith(3, "dub");
    expect(node.querySelector('section[aria-label="Episodes"]')).toBeNull();

    await act(async () =>
      root.render(
        <AniPmPlayer
          {...props}
          episode={3}
          stream={{ ...props.stream, url: aniPmUrl(1, 3, "dub") }}
        />,
      ),
    );
    expect(player.loadEpisode).toHaveBeenCalledWith(3, {
      lang: "dub",
      start: 0,
    });
    expect(window.AniPM.Player).toHaveBeenCalledTimes(1);
    expect(player.destroy).not.toHaveBeenCalled();
    act(() => root.unmount());
  } finally {
    window.AniPM = original;
    node.remove();
    localStorage.clear();
  }
});
