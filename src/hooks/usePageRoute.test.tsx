import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  animePage,
  episodePage,
  parsePageRoute,
  usePageRoute,
} from "./usePageRoute";
import { takeScroll } from "../utils/sectionScroll";
test("routes parse shareable sections, titles, episodes and safe provider options", () => {
  expect(parsePageRoute("/discover").view).toBe("discover");
  expect(parsePageRoute("/my-list").view).toBe("my-list");
  expect(parsePageRoute("/calendar").view).toBe("dub-releases");
  expect(parsePageRoute("/anime/16498").animeId).toBe(16498);
  expect(
    parsePageRoute("/anime/16498/episode/5", "?audio=dub&source=anipm"),
  ).toMatchObject({
    view: "details",
    animeId: 16498,
    episode: 5,
    play: true,
    audio: "dub",
    source: "anipm",
  });
  expect(parsePageRoute("/anime/1/episode/0").view).toBe("not-found");
  expect(parsePageRoute("/anime/1/episode/NaN").view).toBe("not-found");
  expect(parsePageRoute("/anime/9999999999999999999999").view).toBe(
    "not-found",
  );
  expect(parsePageRoute("/anime/1", "?episode=bad").view).toBe("not-found");
  expect(parsePageRoute("/other-site").view).toBe("not-found");
  expect(
    parsePageRoute("/anime/1/episode/2", "?source=https://evil.example").source,
  ).toBe("anipm");
  expect(animePage(1, 3)).toBe("/anime/1?episode=3");
  expect(episodePage(1, 3, "dub", "megaplay")).toBe(
    "/anime/1/episode/3?audio=dub&source=megaplay",
  );
});
test("navigation adds real history entries, ignores duplicate events and restores popstate without pushing", () => {
  window.history.replaceState({}, "", "/");
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  let router: ReturnType<typeof usePageRoute>;
  function Harness() {
    router = usePageRoute();
    return (
      <span>
        {router.route.view}:{router.route.episode}
      </span>
    );
  }
  try {
    act(() => root.render(<Harness />));
    const initial = window.history.length;
    act(() => router.navigate("/discover"));
    act(() => router.navigate("/anime/1"));
    act(() => router.navigate(episodePage(1, 2)));
    expect(window.location.pathname).toBe("/anime/1/episode/2");
    expect(window.history.length).toBe(initial + 3);
    act(() => router.navigate(episodePage(1, 2)));
    expect(window.history.length).toBe(initial + 3);
    act(() => {
      window.history.replaceState({ apexIndex: 1 }, "", "/discover");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(node.textContent).toBe("discover:");
    expect(window.history.length).toBe(initial + 3);
    act(() => {
      window.history.replaceState({ apexIndex: 0 }, "", "/anime/1");
      window.dispatchEvent(new PopStateEvent("popstate"));
      router.back();
    });
    expect(window.location.pathname).toBe("/");
    expect(window.history.length).toBe(initial + 3);
  } finally {
    act(() => root.unmount());
    node.remove();
    window.history.replaceState({}, "", "/");
  }
});

test("closing playback returns to its detail entry and Back reaches the original page", async () => {
  window.history.replaceState({}, "", "/discover?studio=14");
  const node = document.createElement("div");
  const root = createRoot(node);
  let router!: ReturnType<typeof usePageRoute>;
  function Harness() {
    router = usePageRoute();
    return null;
  }
  const traverse = async (action: () => void) => {
    await act(async () => {
      const popped = new Promise<void>((resolve) =>
        window.addEventListener("popstate", () => resolve(), { once: true }),
      );
      action();
      await popped;
    });
  };
  try {
    act(() => root.render(<Harness />));
    act(() => router.navigate("/anime/1"));
    act(() => router.navigate(episodePage(1, 2)));
    const length = window.history.length;
    act(() => router.navigate(episodePage(1, 3, "dub")));
    expect(window.history.length).toBe(length);
    await traverse(() => router.closePlayer("/anime/1?episode=3"));
    expect(window.location.pathname).toBe("/anime/1");
    expect(router.route.play).toBe(false);
    await traverse(() => window.history.back());
    expect(window.location.pathname + window.location.search).toBe(
      "/discover?studio=14",
    );

    // Direct play from a list has no detail entry to return to.
    act(() => router.navigate(episodePage(1, 4)));
    act(() => router.closePlayer("/anime/1?episode=4"));
    expect(window.location.pathname + window.location.search).toBe(
      "/anime/1?episode=4",
    );
    await traverse(() => window.history.back());
    expect(window.location.pathname).toBe("/discover");
  } finally {
    act(() => root.unmount());
    window.history.replaceState({}, "", "/");
  }
});

test("route changes remember the outgoing section scroll and never force a reset", () => {
  window.history.replaceState({}, "", "/");
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  const setY = (y: number) =>
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  let router!: ReturnType<typeof usePageRoute>;
  function Harness() {
    router = usePageRoute();
    return <span>{router.route.view}</span>;
  }
  try {
    act(() => root.render(<Harness />));
    act(() => router.navigate("/discover"));
    setY(640);
    act(() => router.navigate("/anime/1"));
    expect(takeScroll("discover")).toBe(640);
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      window.history.replaceState({ apexIndex: 0 }, "", "/discover");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(node.textContent).toContain("discover");
    expect(scrollTo).not.toHaveBeenCalled();
    setY(120);
    act(() => router.navigate("/my-list"));
    expect(takeScroll("discover")).toBe(120);
    expect(takeScroll("my-list")).toBe(0);
  } finally {
    act(() => root.unmount());
    node.remove();
    window.history.replaceState({}, "", "/");
    if (scrollYDescriptor)
      Object.defineProperty(window, "scrollY", scrollYDescriptor);
    else Reflect.deleteProperty(window, "scrollY");
    scrollTo.mockRestore();
  }
});
