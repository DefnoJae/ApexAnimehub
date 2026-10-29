import { personalScore } from "./PosterPersonalRating";
test("personal badges match IDs, prefer rated AniList values, and never invent scores", () => {
  const entries: any[] = [
    { provider: "mal", anime: { idMal: 20 }, score: 7 },
    { provider: "anilist", anime: { id: 10, idMal: 20 }, score: 9 },
    { provider: "anilist", anime: { id: 30 }, score: 0 },
  ];
  expect(personalScore(entries, { id: 10 })).toBe(9);
  expect(personalScore(entries, { idMal: 20 })).toBe(9);
  expect(personalScore(entries, { id: 30 })).toBeUndefined();
  expect(personalScore(entries, { id: 99 })).toBeUndefined();
  expect(personalScore([{ ...entries[1], score: 8 }], { id: 10 })).toBe(8);
});

test("missing anime metadata hides the badge while Home data is loading", () => {
  expect(personalScore([], undefined)).toBeUndefined();
  expect(personalScore([], null)).toBeUndefined();
});
