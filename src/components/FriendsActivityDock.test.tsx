import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { FriendsActivityDock } from "./FriendsActivityDock";
import { fetchFriendsActivity } from "../utils/friendsActivity";
jest.mock("../utils/friendsActivity", () => ({
  ...jest.requireActual("../utils/friendsActivity"),
  fetchFriendsActivity: jest.fn(),
}));
let node: HTMLDivElement, root: Root;
beforeEach(() => {
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  (fetchFriendsActivity as jest.Mock).mockResolvedValue({
    friends: [
      {
        id: 1,
        name: "Friend One",
        status: "CURRENT",
        progress: 1,
        total: 12,
        score: 7,
      },
      { id: 2, name: "Friend Two", status: "COMPLETED", progress: 24 },
    ],
    nextPage: null,
  });
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  jest.clearAllMocks();
});
test("collapsed dock expands on tap/focus, preserves profile links and never refetches on hover", async () => {
  await act(async () =>
    root.render(<FriendsActivityDock animeId={21} identity="77" connected />),
  );
  const toggle = node.querySelector("button")!;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(node.querySelectorAll(".friends-avatar")).toHaveLength(2);
  expect(node.querySelectorAll(".friends-score")).toHaveLength(1);
  expect(node.textContent).toContain("Ep 1/12");
  expect(node.textContent).toContain("Ep 24");
  expect(node.textContent).not.toContain("24/0");
  act(() => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  act(() =>
    node
      .querySelector("aside")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
  );
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  act(() => toggle.focus());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  act(() => toggle.click());
  act(() => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(fetchFriendsActivity).toHaveBeenCalledTimes(1);
  const profile = node.querySelector("a")!;
  expect(profile.href).toBe("https://anilist.co/user/Friend%20One");
  expect(profile.rel).toContain("noopener");
});
test("empty/disconnected docks stay hidden and errors offer retry", async () => {
  await act(async () =>
    root.render(
      <FriendsActivityDock animeId={21} identity="77" connected={false} />,
    ),
  );
  expect(node.querySelector("aside")).toBeNull();
  expect(fetchFriendsActivity).not.toHaveBeenCalled();
  (fetchFriendsActivity as jest.Mock).mockResolvedValueOnce({
    friends: [],
    nextPage: null,
  });
  await act(async () =>
    root.render(<FriendsActivityDock animeId={21} identity="77" connected />),
  );
  expect(node.querySelector("aside")).toBeNull();
  (fetchFriendsActivity as jest.Mock).mockRejectedValueOnce(
    new Error("offline"),
  );
  await act(async () =>
    root.render(<FriendsActivityDock animeId={22} identity="77" connected />),
  );
  expect(node.textContent).toContain("Retry");
  await act(async () =>
    Array.from(node.querySelectorAll("button"))
      .find((b) => b.textContent === "Retry")!
      .click(),
  );
  expect(node.querySelectorAll(".friends-avatar")).toHaveLength(2);
});

test("first touch on an avatar expands instead of navigating away", async () => {
  await act(async () =>
    root.render(<FriendsActivityDock animeId={21} identity="77" connected />),
  );
  const avatar = node.querySelector("a")!;
  const pointer = new Event("pointerdown", { bubbles: true });
  Object.defineProperty(pointer, "pointerType", { value: "touch" });
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    avatar.dispatchEvent(pointer);
    avatar.dispatchEvent(click);
  });
  expect(click.defaultPrevented).toBe(true);
  expect(node.querySelector("button")!.getAttribute("aria-expanded")).toBe(
    "true",
  );
});
