import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { FollowingStories, StoryViewer } from "./FollowingStories";
import { fetchFollowingStories, StoryGroup } from "../utils/followingStories";
jest.mock("../utils/followingStories", () => ({
  ...jest.requireActual("../utils/followingStories"),
  fetchFollowingStories: jest.fn(),
}));
const groups: StoryGroup[] = [
  {
    user: { id: 5, name: "Friend" },
    activities: [
      {
        id: 1,
        createdAt: 100,
        status: "watched episode",
        progress: "3",
        user: { id: 5, name: "Friend" },
        anime: { id: 10, title: { english: "Anime" } },
        score: 8,
      },
      {
        id: 2,
        createdAt: 110,
        status: "completed",
        user: { id: 5, name: "Friend" },
        anime: { id: 10, title: { english: "Anime" } },
      },
    ],
  },
  {
    user: { id: 6, name: "Other" },
    activities: [
      {
        id: 3,
        createdAt: 120,
        status: "plans to watch",
        user: { id: 6, name: "Other" },
        anime: { id: 11, title: { english: "Next anime" } },
      },
    ],
  },
];
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  localStorage.clear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.useRealTimers();
});
test("viewer advances automatically, pauses, navigates user previews and closes on Escape", () => {
  jest.useFakeTimers("modern");
  const close = jest.fn(),
    seen = jest.fn();
  act(() =>
    root.render(
      <StoryViewer
        groups={groups}
        seen={[]}
        onSeen={seen}
        loading={false}
        error=""
        warning=""
        connected
        reload={jest.fn()}
        onConnect={jest.fn()}
        onClose={close}
      />,
    ),
  );
  expect(host.textContent).toContain("Watched episode 3");
  expect(host.textContent).toContain("8/10");
  act(() => jest.advanceTimersByTime(6100));
  expect(host.textContent).toContain("Completed");
  act(() =>
    host
      .querySelector<HTMLButtonElement>('[aria-label="Pause stories"]')!
      .click(),
  );
  act(() => jest.advanceTimersByTime(7000));
  expect(host.querySelector(".following-story-card")?.textContent).toContain(
    "Completed",
  );
  act(() =>
    host
      .querySelector<HTMLButtonElement>(
        '[aria-label="Preview stories from Other"]',
      )!
      .click(),
  );
  expect(host.querySelector(".following-story-card")?.textContent).toContain(
    "Next anime",
  );
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(close).toHaveBeenCalled();
});
test("empty ring uses no avatar, new activity glows, and viewed state is account scoped", async () => {
  (fetchFollowingStories as jest.Mock).mockResolvedValue({
    groups,
    at: Date.now(),
  });
  await act(async () =>
    root.render(
      <FollowingStories identity="123" connected onConnect={jest.fn()} />,
    ),
  );
  const trigger = host.querySelector<HTMLButtonElement>(
    ".following-stories-trigger",
  )!;
  expect(trigger.querySelector("img")).toBeNull();
  expect(trigger.className).toContain("has-new");
  act(() => trigger.click());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(
    JSON.parse(localStorage.getItem("apex_stories_seen_v1_123")!),
  ).toContain(1);
  act(() =>
    document
      .querySelector<HTMLButtonElement>(
        '[aria-label="Close following activity"]',
      )!
      .click(),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
