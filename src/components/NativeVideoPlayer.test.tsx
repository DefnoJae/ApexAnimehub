import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import NativeVideoPlayer from "./NativeVideoPlayer";
import type { PlayerProps } from "./VideoPlayer";

test("native shortcuts navigate episodes and playback syncs once at 80%", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () => ({
    ok: true,
    json: async () => ({ url: "https://stream.animeparadise.moe/test.mp4", audio: "sub", subtitles: [] }),
  }) as Response);
  const node = document.body.appendChild(document.createElement("div"));
  const root = createRoot(node);
  const props = {
    title: "Example",
    episode: 2,
    stream: { name: "Apex Player (Sub)", url: "/api/playback?id=1&episode=2" },
    canNext: true,
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onEpisodeChange: jest.fn(),
    onWatched: jest.fn(),
    onClose: jest.fn(),
    accounts: { autoSync: true },
  } as unknown as PlayerProps;
  try {
    await act(async () => root.render(<NativeVideoPlayer {...props} />));
    const video = node.querySelector("video")!;
    video.play = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, "duration", { value: 100 });
    act(() => video.dispatchEvent(new Event("loadedmetadata")));
    const key = (value: string) => act(() => document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }),
    ));
    video.currentTime = 40;
    key("ArrowRight");
    expect(video.currentTime).toBe(50);
    key("ArrowLeft");
    expect(video.currentTime).toBe(40);
    key("n");
    key("b");
    expect(props.onEpisodeChange).toHaveBeenCalledTimes(2);
    expect(props.onEpisodeChange).toHaveBeenNthCalledWith(1, 3, "sub");
    expect(props.onEpisodeChange).toHaveBeenNthCalledWith(2, 1, "sub");
    const tick = (time: number) => act(() => {
      video.currentTime = time;
      video.dispatchEvent(new Event("timeupdate"));
    });
    tick(79);
    expect(props.onWatched).not.toHaveBeenCalled();
    tick(80);
    tick(81);
    expect(props.onWatched).toHaveBeenCalledTimes(1);
    act(() => video.dispatchEvent(new Event("ended")));
    expect(props.onEpisodeChange).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    fetchMock.mockRestore();
    localStorage.clear();
    node.remove();
  }
});
