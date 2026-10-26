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
