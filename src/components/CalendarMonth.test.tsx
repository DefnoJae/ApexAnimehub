import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { CalendarMonth } from "./CalendarMonth";
import { isScheduleFinale } from "./ScheduleFinale";
import type { CalendarRelease } from "../utils/animeSchedule";
const release: CalendarRelease = {
  key: "first",
  language: "sub",
  at: +new Date(2026, 10, 10, 10),
  episode: 12,
  anime: {
    id: 1,
    title: { english: "First anime" },
    episodes: 12,
    bannerImage: "https://example.com/first.jpg",
  },
};
test("finale flags require a known positive episode total", () => {
  expect(isScheduleFinale(release)).toBe(true);
  expect(isScheduleFinale({ ...release, episode: 11 })).toBe(false);
  expect(
    isScheduleFinale({
      ...release,
      anime: { ...release.anime, episodes: null },
    }),
  ).toBe(false);
  expect(
    isScheduleFinale({ ...release, anime: { ...release.anime, episodes: 0 } }),
  ).toBe(false);
});
test("hovering a title changes that date's backdrop and shows a finale flag", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const second = {
    ...release,
    key: "second",
    episode: 3,
    anime: {
      ...release.anime,
      id: 2,
      title: { english: "Second anime" },
      bannerImage: "https://example.com/second.jpg",
    },
  };
  try {
    act(() =>
      root.render(
        <CalendarMonth
          month={new Date(2026, 10, 1)}
          onMonth={jest.fn()}
          entries={new Map([["2026-11-10", [release, second]]])}
          selected={new Date(2026, 10, 10)}
          onSelect={jest.fn()}
          onClose={jest.fn()}
          onDay={jest.fn()}
          controls={null}
          status={null}
          loading={false}
        />,
      ),
    );
    const day = document.querySelector('[data-calendar-date="2026-11-10"]')!;
    expect(day.querySelectorAll(".calendar-finale")).toHaveLength(1);
    expect(day.querySelector("img")!.getAttribute("src")).toBe(
      release.anime.bannerImage,
    );
    const row = day.querySelectorAll(".calendar-cell-releases > span")[1];
    act(() =>
      row.dispatchEvent(
        new MouseEvent("pointerover", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      ),
    );
    expect(day.querySelector("img")!.getAttribute("src")).toBe(
      second.anime.bannerImage,
    );
    act(() =>
      row.dispatchEvent(
        new MouseEvent("pointerout", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      ),
    );
    expect(day.querySelector("img")!.getAttribute("src")).toBe(
      release.anime.bannerImage,
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
