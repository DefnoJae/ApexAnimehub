import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import NativeVideoPlayer from "./NativeVideoPlayer";
import type { PlayerProps } from "./VideoPlayer";

test("native shortcuts navigate episodes and playback syncs once at 80%", async () => {
  jest.useFakeTimers();
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:captions");
  URL.revokeObjectURL = jest.fn();
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
    ok: true,
    json: async () => ({ url: "https://stream.animeparadise.moe/test.mp4", audio: "sub", subtitles: [{ url: "https://example.test/english.vtt", label: "English", format: "vtt" }]  }),
    text: async () => String(input).endsWith(".vtt") ? "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello" : "",
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
    const host = node.firstElementChild as HTMLElement;
    host.requestFullscreen = jest.fn().mockResolvedValue(undefined);
    const video = node.querySelector("video")!;
    video.play = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, "duration", { value: 100 });
    act(() => video.dispatchEvent(new Event("loadedmetadata")));
    const caption = video.querySelector("track")!;
    expect(caption.getAttribute("src")).toBe("blob:captions");
    const textTrack = { mode: "showing" };
    Object.defineProperty(caption, "track", { value: textTrack });
    act(() => jest.advanceTimersByTime(550));
    expect(node.querySelector(".apex-cinema")?.classList.contains("has-pause-overlay")).toBe(true);
    expect(textTrack.mode).toBe("hidden");
    act(() => video.dispatchEvent(new Event("play")));
    expect(textTrack.mode).toBe("showing");
    const key = (value: string) => act(() => document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }),
    ));
    video.currentTime = 40;
    key("ArrowRight");
    expect(video.currentTime).toBe(50);
    key("ArrowLeft");
    expect(video.currentTime).toBe(40);
    key("f");
    expect(host.requestFullscreen).toHaveBeenCalledTimes(1);
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
    await act(async () => root.render(<NativeVideoPlayer {...props} episode={3}
      stream={{ ...props.stream, url: "/api/playback?id=1&episode=3" }} />));
    expect(node.firstElementChild).toBe(host);
    expect(node.querySelector("video")).not.toBe(video);
  } finally {
    act(() => root.unmount());
    fetchMock.mockRestore();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    jest.useRealTimers();
    localStorage.clear();
    node.remove();
  }
});
