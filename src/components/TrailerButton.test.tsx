import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { TrailerButton, youtubeTrailerId } from "./TrailerButton";
let node: HTMLDivElement, root: Root;
beforeEach(() => {
  jest.useFakeTimers();
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  jest.useRealTimers();
});
test("hides invalid/missing trailers and rejects URL injection", () => {
  expect(
    youtubeTrailerId({ id: "https://evil.test", site: "youtube" }),
  ).toBeNull();
  expect(
    youtubeTrailerId({ id: "abcdefghijk", site: "dailymotion" }),
  ).toBeNull();
  act(() => root.render(<TrailerButton title="Anime" />));
  expect(node.querySelector("button")).toBeNull();
  expect(youtubeTrailerId({id:"abcdefghijk\t",site:"youtube"})).toBe("abcdefghijk");
});
test("opens a controlled autoplay YouTube embed and stops playback immediately on Escape", () => {
  act(() =>
    root.render(
      <TrailerButton
        title="Anime Season 2"
        trailer={{ id: "abcdefghijk", site: "youtube" }}
      />,
    ),
  );
  const trigger = node.querySelector("button")!;
  act(() => trigger.click());
  const modal = document.querySelector('[role="dialog"]')!;
  const iframe = modal.querySelector("iframe")!;
  expect(iframe.src).toContain(
    "youtube-nocookie.com/embed/abcdefghijk?autoplay=1&controls=1",
  );
  expect(iframe.allowFullscreen).toBe(true);
  expect(modal.textContent).toContain("Anime Season 2");
  expect(document.body.style.overflow).toBe("hidden");
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.querySelector("iframe")).toBeNull();
  act(() => jest.advanceTimersByTime(200));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).not.toBe("hidden");
});
test("outside click and X both stop the embedded trailer", () => {
  act(() =>
    root.render(
      <TrailerButton
        title="Anime"
        trailer={{ id: "abcdefghijk", site: "youtube" }}
      />,
    ),
  );
  const trigger = node.querySelector("button")!;
  act(() => trigger.click());
  act(() =>
    document
      .querySelector(".trailer-overlay")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
  );
  expect(document.querySelector("iframe")).toBeNull();
  act(() => jest.advanceTimersByTime(200));
  act(() => trigger.click());
  act(() =>
    (
      document.querySelector(
        '[aria-label="Close trailer"]',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(document.querySelector("iframe")).toBeNull();
});
