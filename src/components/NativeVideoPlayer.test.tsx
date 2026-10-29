import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import NativeVideoPlayer from "./NativeVideoPlayer";
import type { PlayerProps } from "./VideoPlayer";
import Artplayer from "artplayer";
let mockOptions: any;
const mockListeners: Record<string, () => void> = {};
const mockPlayer = {
  toggle: jest.fn(),
  currentTime: 0,
  duration: 100,
  on: jest.fn((name, cb) => {
    mockListeners[name] = cb;
  }),
  destroy: jest.fn(),
  subtitle: { show: true, switch: jest.fn() },
};
jest.mock("artplayer", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((options) => {
    mockOptions = options;
    return mockPlayer;
  }),
}));
test("native controls route episodes and track only at 80%, once; cleanup destroys player", async () => {
  (Artplayer as unknown as jest.Mock).mockImplementation((options) => {
    mockOptions = options;
    return mockPlayer;
  });
  mockPlayer.on.mockImplementation((name, cb) => {
    mockListeners[name] = cb;
  });
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      url: "https://stream.animeparadise.moe/test",
      subtitles: [],
    }),
  });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const next = jest.fn(),
    previous = jest.fn(),
    watched = jest.fn();
  const props = {
    title: "Example",
    episode: 2,
    stream: { name: "Apex Player (Sub)", url: "/api/playback?id=1&episode=2" },
    canNext: true,
    onNext: next,
    onPrevious: previous,
    onWatched: watched,
    onClose: jest.fn(),
    onFallback: jest.fn(),
    accounts: { autoSync: true },
  } as unknown as PlayerProps & { onFallback: () => void };
  try {
    await act(async () => root.render(<NativeVideoPlayer {...props} />));
    act(() =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(mockPlayer.toggle).toHaveBeenCalled();
    mockPlayer.currentTime = 40;
    act(() =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(mockPlayer.currentTime).toBe(50);
    act(() =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(mockPlayer.currentTime).toBe(40);
    mockOptions.controls.find((c: any) => c.name === "next-episode").click();
    mockOptions.controls
      .find((c: any) => c.name === "previous-episode")
      .click();
    expect(next).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledTimes(1);
    mockPlayer.currentTime = 79;
    mockListeners["video:timeupdate"]();
    expect(watched).not.toHaveBeenCalled();
    mockPlayer.currentTime = 80;
    mockListeners["video:timeupdate"]();
    mockListeners["video:timeupdate"]();
    expect(watched).toHaveBeenCalledTimes(1);
    expect(mockOptions.autoplay).toBe(true);
    const autoNext = mockOptions.settings.find(
      (item: any) => item.name === "auto-next",
    );
    expect(autoNext.switch).toBe(true);
    autoNext.onSwitch({ switch: true });
    mockListeners["video:ended"]();
    expect(next).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("apex_player_auto_next")).toBe("false");
    autoNext.onSwitch({ switch: false });
    mockListeners["video:ended"]();
    mockListeners["video:ended"]();
    expect(next).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
    expect(mockPlayer.destroy).toHaveBeenCalled();
  } finally {
    global.fetch = original;
    localStorage.clear();
    node.remove();
  }
});
