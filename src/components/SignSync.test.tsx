import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SignSync } from "./SignSync";
test("SignSync loads timed text, keeps source captions untouched, and closes its panel for fullscreen", async () => {
  localStorage.clear();
  jest.useFakeTimers();
  const before = global.fetch;
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        tracks: [
          {
            id: "1",
            label: "English Signs",
            cues: [{ start: 10, end: 15, text: "Street sign" }],
          },
        ],
        message: "Timing is unverified.",
      }),
    });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  let time = 11;
  function Player() {
    const host = useRef<HTMLDivElement>(null);
    return (
      <div ref={host} className="apex-native-player">
        <div className="native-player-header">
          <SignSync
            animeId={1}
            episode={2}
            language="dub"
            root={host}
            position={() => time}
          />
          <button>Fullscreen</button>
          <button>Close</button>
        </div>
      </div>
    );
  }
  try {
    await act(async () => root.render(<Player />));
    act(() =>
      (node.querySelector(".signsync-trigger") as HTMLButtonElement).click(),
    );
    expect(node.querySelector(".signsync-panel")).not.toBeNull();
    await act(async () =>
      (node.querySelector(".signsync-find") as HTMLButtonElement).click(),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/signsync?id=1&episode=2",
      expect.anything(),
    );
    expect(node.querySelector(".signsync-captions")?.textContent).toBe(
      "Street sign",
    );
    time = 16;
    act(() => jest.advanceTimersByTime(100));
    expect(node.querySelector(".signsync-captions")).toBeNull();
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: node.firstChild,
    });
    act(() => document.dispatchEvent(new Event("fullscreenchange")));
    expect(node.querySelector(".signsync-panel")).toBeNull();
    expect(
      node.querySelector(".native-player-header .signsync-trigger")
        ?.nextElementSibling?.textContent,
    ).toBe("Fullscreen");
  } finally {
    act(() => root.unmount());
    node.remove();
    global.fetch = before;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    jest.useRealTimers();
    localStorage.clear();
  }
});
