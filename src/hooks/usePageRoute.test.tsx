import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  animePage,
  episodePage,
  parsePageRoute,
  usePageRoute,
} from "./usePageRoute";
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
