import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { DubScheduleView } from "./DubScheduleView";
import { fetchCalendarRange, CalendarRelease } from "../utils/animeSchedule";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("../utils/animeSchedule", () => ({
  ...jest.requireActual("../utils/animeSchedule"),
  fetchCalendarRange: jest.fn(),
}));
const entries: CalendarRelease[] = [
  {
    key: "sub:1",
    anime: { id: 1, title: { english: "Tuesday anime" }, format: "TV" },
    at: +new Date(2026, 10, 10, 10),
    episode: 1,
    language: "sub",
  },
  {
    key: "dub:2",
    anime: { id: 2, title: { english: "Tuesday dub" }, format: "TV" },
    at: +new Date(2026, 10, 10, 11),
    episode: 6,
    language: "dub",
  },
  {
    key: "dub:3",
    anime: { id: 3, title: { english: "Monday anime" }, format: "ONA" },
    at: +new Date(2026, 10, 9, 10),
    episode: 2,
    language: "dub",
  },
];
const accounts = {
  libraryEntries: [{ anime: { id: 1 }, status: "watching", progress: 0 }],
} as ReturnType<typeof useAccounts>;
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 10, 12));
  localStorage.clear();
  host = document.createElement("div");
  host.id = "root";
  document.body.append(host);
  root = createRoot(host);
  (fetchCalendarRange as jest.Mock).mockResolvedValue({
    entries,
    updatedAt: Date.now(),
    warnings: [],
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.useRealTimers();
});
test("Sunday–Saturday tabs start on today; release clicks select the precise episode and remembered preferences survive", async () => {
  const select = jest.fn();
  await act(async () =>
    root.render(<DubScheduleView accounts={accounts} onSelectMedia={select} />),
  );
  const tabs = host.querySelectorAll('[role="tab"]');
  expect(tabs).toHaveLength(7);
  expect(tabs[0].textContent).toContain("Sunday");
  expect(tabs[2].getAttribute("aria-selected")).toBe("true");
  expect(host.querySelectorAll(".calendar-release-card")).toHaveLength(2);
  act(() =>
    host.querySelector<HTMLButtonElement>(".calendar-release-card")!.click(),
  );
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ id: 1, releaseEpisode: 1 }),
    1,
  );
  await act(async () =>
    Array.from(
      host.querySelectorAll<HTMLButtonElement>(".calendar-language button"),
    )
      .find((button) => button.textContent === "Dub")!
      .click(),
  );
  expect(host.querySelectorAll(".calendar-release-card")).toHaveLength(1);
  expect(
    JSON.parse(localStorage.getItem("apex_calendar_preferences_v1")!).language,
  ).toBe("dub");
  act(() => tabs[1].dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(host.querySelector(".calendar-release-card")?.textContent).toContain(
    "Monday anime",
  );
});
test("Yours uses actual library IDs, is remembered, and a date opens a monthly release popover", async () => {
  localStorage.setItem(
    "apex_calendar_preferences_v1",
    JSON.stringify({ language: "all", scope: "yours" }),
  );
  const select = jest.fn();
  await act(async () =>
    root.render(<DubScheduleView accounts={accounts} onSelectMedia={select} />),
  );
  expect(host.querySelectorAll(".calendar-release-card")).toHaveLength(1);
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('[aria-label="Open monthly calendar"]')!
      .click(),
  );
  expect(document.querySelector(".calendar-month-weekdays")?.textContent).toBe(
    "SunMonTueWedThuFriSat",
  );
  const day = document.querySelector<HTMLButtonElement>(
    '[data-calendar-date="2026-11-10"]',
  )!;
  act(() => day.click());
  expect(document.querySelector("#calendar-date-popover")).not.toBeNull();
  expect(document.querySelectorAll(".calendar-popover-release")).toHaveLength(
    1,
  );
  act(() =>
    document
      .querySelector<HTMLButtonElement>(".calendar-popover-release")!
      .click(),
  );
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ id: 1, releaseEpisode: 1 }),
    1,
  );
  expect(document.querySelector(".calendar-month-modal")).toBeNull();
  expect(host.hasAttribute("inert")).toBe(false);
  expect(host.hasAttribute("aria-hidden")).toBe(false);
});
