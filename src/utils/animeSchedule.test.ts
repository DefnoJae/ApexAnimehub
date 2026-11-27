import {
  dateKey,
  defaultCalendarPreferences,
  fetchCalendarRange,
  filterCalendar,
  monthGrid,
  readCalendarPreferences,
  readCachedCalendarRange,
  sundayWeek,
  CalendarRelease,
} from "./animeSchedule";
import { fetchAnilist } from "./anilist";
import { fetchDubRange } from "./dubSchedule";
jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));
jest.mock("./dubSchedule", () => ({
  fetchDubRange: jest.fn(),
  isoWeek: (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    return { year, week: Math.ceil((((d.getTime() - Date.UTC(year, 0, 1)) / 86400000) + 1) / 7) };
  },
  validSchedule: (value: unknown) =>
    Array.isArray(value) &&
    value.every(
      (e) =>
        e &&
        typeof e.title === "string" &&
        typeof e.episodeDate === "string" &&
        Number.isFinite(Date.parse(e.episodeDate)) &&
        typeof e.episodeNumber === "number",
    ),
}));
beforeEach(() => {
  localStorage.clear();
});
test("Sunday weeks, leap-month boundaries and invalid preferences", () => {
  expect(dateKey(sundayWeek(new Date(2026, 10, 10, 19)).start)).toBe(
    "2026-11-08",
  );
  expect(monthGrid(new Date(2026, 10, 1)).days[0].getDay()).toBe(0);
  const feb = monthGrid(new Date(2024, 1, 1));
  expect(feb.days.filter((day) => day.getMonth() === 1)).toHaveLength(29);
  expect(feb.days.length % 7).toBe(0);
  localStorage.setItem(
    "apex_calendar_preferences_v1",
    JSON.stringify({ language: "bad", scope: "bad" }),
  );
  expect(readCalendarPreferences()).toEqual(defaultCalendarPreferences);
});
test("filters by language, format and stable IDs in either library provider", () => {
  const item: CalendarRelease = {
    key: "x",
    anime: { id: 9, idMal: 99, title: { english: "Anime" }, format: "TV" },
    at: 1,
    episode: 1,
    language: "dub",
  };
  const prefs = { ...defaultCalendarPreferences, scope: "yours" as const };
  expect(
    filterCalendar([item], prefs, "", [
      {
        anime: { id: 0, idMal: 99 },
        status: "planning",
        progress: 0,
        updatedAt: 1,
      },
    ]),
  ).toHaveLength(1);
  expect(
    filterCalendar([item], { ...prefs, language: "sub" }, "", []),
  ).toHaveLength(0);
  expect(
    filterCalendar(
      [item],
      { ...defaultCalendarPreferences, format: "OVA" },
      "",
      [],
    ),
  ).toHaveLength(0);
});
test("loads sub pages and dub releases independently and enriches missing AniList IDs by MAL ID", async () => {
  (fetchAnilist as jest.Mock).mockImplementation(
    async (query: string, vars: { page: number }) =>
      query.includes("CalendarMetadata")
        ? {
            Page: {
              media: [
                {
                  id: 22,
                  idMal: 222,
                  title: { english: "Dub title" },
                  format: "TV",
                  bannerImage: "https://example.com/banner.jpg",
                },
              ],
            },
          }
        : {
            Page: {
              pageInfo: { hasNextPage: vars.page === 1 },
              airingSchedules:
                vars.page === 1
                  ? [
                      {
                        id: 123,
                        episode: 3,
                        airingAt: +new Date(2026, 10, 11) / 1000,
                        media: {
                          id: 11,
                          title: { english: "Sub title" },
                          format: "TV",
                        },
                      },
                    ]
                  : [],
            },
          },
  );
  (fetchDubRange as jest.Mock).mockResolvedValue({
    entries: [
      {
        route: "dub-title",
        episodeNumber: 2,
        episodeDate: new Date(2026, 10, 11, 3).toISOString(),
        media: { media: { id: 0, idMal: 222, title: { english: "Dub" } } },
      },
    ],
    updatedAt: 1234,
    cached: false,
  });
  const result = await fetchCalendarRange(
    new Date(2026, 10, 8),
    new Date(2026, 10, 15),
    "all",
    new AbortController().signal,
  );
  expect(result.entries).toHaveLength(2);
  expect(result.entries.find((item) => item.language === "dub")?.anime.id).toBe(
    22,
  );
  expect(
    (fetchAnilist as jest.Mock).mock.calls.filter(([query]) =>
      query.includes("CalendarSchedule"),
    ),
  ).toHaveLength(2);
  (fetchDubRange as jest.Mock).mockRejectedValue(new Error("Offline"));
  const partial = await fetchCalendarRange(
    new Date(2026, 10, 8),
    new Date(2026, 10, 15),
    "all",
    new AbortController().signal,
  );
  expect(partial.entries).toHaveLength(1);
  expect(partial.warnings).toHaveLength(1);
});
test("readCachedCalendarRange returns cached sub and dub entries synchronously with no cache miss", () => {
  const start = new Date(2026, 10, 8);
  const end = new Date(2026, 10, 15);
  const key = dateKey(start) + ":" + dateKey(end);
  localStorage.setItem(
    "apex_calendar_sub_cache_v1",
    JSON.stringify([
      {
        key,
        updatedAt: Date.now() - 10000,
        entries: [
          {
            key: "sub:123",
            anime: {
              id: 11,
              idMal: 111,
              title: { english: "Sub title" },
              format: "TV",
              coverImage: { extraLarge: "https://example.com/sub.jpg" },
            },
            episode: 3,
            at: +new Date(2026, 10, 11),
            language: "sub",
          },
        ],
      },
    ]),
  );
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const weekKey = "apex_timetable_2026-45_" + timezone;
  localStorage.setItem(
    weekKey,
    JSON.stringify({
      entries: [
        {
          title: "Dub title",
          route: "dub-title",
          episodeNumber: 2,
          episodeDate: new Date(2026, 10, 11, 3).toISOString(),
          media: { media: { id: 0, idMal: 222, title: { english: "Dub" } } },
          format: "TV",
        },
      ],
      updatedAt: Date.now() - 20000,
    }),
  );
  const result = readCachedCalendarRange(start, end, "all");
  expect(result.entries).toHaveLength(2);
  expect(
    result.entries.find((item) => item.language === "sub")?.anime.id,
  ).toBe(11);
  expect(
    result.entries.find((item) => item.language === "dub")?.anime.idMal,
  ).toBe(222);
  expect(Number.isFinite(result.updatedAt || 0)).toBe(true);
});
test("readCachedCalendarRange returns empty when nothing is cached", () => {
  localStorage.removeItem("apex_calendar_sub_cache_v1");
  const result = readCachedCalendarRange(
    new Date(2026, 10, 8),
    new Date(2026, 10, 15),
    "all",
  );
  expect(result.entries).toHaveLength(0);
  expect(result.updatedAt).toBeNull();
});
