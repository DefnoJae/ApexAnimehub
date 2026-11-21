import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { PosterCaption, posterMeta } from "./PosterCaption";

test("posterMeta separates year, type and total with spaced centered dots", () => {
  expect(posterMeta({ year: 2009, format: "TV", episodes: 175 })).toBe(
    "2009 · TV · 175eps",
  );
});

test("posterMeta uses the total even when an airing progress count is present", () => {
  expect(
    posterMeta({
      year: 2026,
      format: "TV",
      episodes: 12,
      nextAiringEpisode: { episode: 5 },
    } as Parameters<typeof posterMeta>[0]),
  ).toBe("2026 · TV · 12eps");
});

test("posterMeta keeps the centered dot when the total is unknown", () => {
  expect(posterMeta({ year: 2020, format: "TV", episodes: null })).toBe(
    "2020 · TV",
  );
});

test("posterMeta omits unknown year, type and episode totals", () => {
  expect(posterMeta({ year: undefined, format: "", episodes: 0 })).toBe("TBA");
  expect(posterMeta({ year: 2020, format: null, episodes: null })).toBe("2020");
  expect(posterMeta({ year: 2020, format: null, episodes: 12 })).toBe(
    "2020 · 12eps",
  );
});

let node: HTMLDivElement, root: Root;
beforeEach(() => {
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
});

test("PosterCaption renders the title and metadata in the overlay", () => {
  act(() => {
    root.render(
      <PosterCaption title="Example" year={2009} format="TV" episodes={175} />,
    );
  });
  expect(node.querySelector(".poster-caption strong")?.textContent).toBe(
    "Example",
  );
  expect(node.querySelector(".poster-caption small")?.textContent).toBe(
    "2009 · TV · 175eps",
  );
});
