import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationBell } from "./NotificationBell";
let root: Root, node: HTMLDivElement, feed: ReturnType<typeof useNotifications>;
function Harness({ scope = "alice" }) {
  feed = useNotifications(scope);
  return <NotificationBell feed={feed} />;
}
beforeEach(() => {
  localStorage.clear();
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
});
test("bell exposes actual sync details, unread actions, keyboard dismissal and scoped history", async () => {
  await act(async () => root.render(<Harness />));
  act(() =>
    feed.notify({
      title: "List update needs attention",
      detail: "AniList: Updated\nMyAnimeList: reconnect required",
      kind: "error",
    }),
  );
  expect(node.querySelector("button")?.getAttribute("aria-label")).toContain(
    "1 unread",
  );
  act(() => node.querySelector("button")!.click());
  expect(node.textContent).toContain("MyAnimeList: reconnect required");
  act(() =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === "Mark all read")!
      .click(),
  );
  expect(feed.unreadCount).toBe(0);
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(node.querySelector("#notification-panel")).toBeNull();
  expect(document.activeElement).toBe(node.querySelector("button"));
  await act(async () => root.render(<Harness scope="bob" />));
  expect(feed.notifications).toHaveLength(0);
  await act(async () => root.render(<Harness scope="alice" />));
  expect(feed.notifications).toHaveLength(1);
  act(() => feed.clearNotifications());
  expect(feed.notifications).toHaveLength(0);
});

test("anime updates show rounded posters while system messages do not; imports are removed and duplicates collapse", async () => {
  localStorage.setItem(
    "apex_notifications_v1_alice",
    JSON.stringify([
      {
        id: "legacy",
        title: "Library imported",
        detail: "AniList",
        kind: "info",
        time: Date.now(),
        read: false,
      },
    ]),
  );
  await act(async () => root.render(<Harness />));
  expect(feed.notifications).toHaveLength(0);
  act(() =>
    feed.notify({ title: "AniList imported", detail: "bulk", kind: "info" }),
  );
  expect(feed.notifications).toHaveLength(0);
  const update = {
    title: "Lists updated",
    detail: "Example anime\nRating updated: 7 → 9",
    kind: "success" as const,
    anime: {
      id: 42,
      title: "Example anime",
      poster: "https://example.com/poster.jpg",
    },
  };
  act(() => {
    feed.notify(update);
    feed.notify(update);
    feed.notify({
      title: "Account connection failed",
      detail: "Reconnect",
      kind: "error",
    });
  });
  expect(feed.notifications).toHaveLength(2);
  act(() => node.querySelector("button")!.click());
  const posters = node.querySelectorAll<HTMLImageElement>(
    ".notification-anime-poster",
  );
  expect(posters).toHaveLength(1);
  expect(posters[0].src).toBe("https://example.com/poster.jpg");
  expect(node.textContent).toContain("Rating updated: 7 → 9");
  act(() => feed.markAllRead());
  expect(feed.unreadCount).toBe(0);
  act(() =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === "Unread")!
      .click(),
  );
  expect(node.querySelectorAll(".notification-item")).toHaveLength(0);
});
