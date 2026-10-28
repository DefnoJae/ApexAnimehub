const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matchSeason, episodeRows } = require("./episodes.cjs");
test("matches the anime season instead of always using season one", () => {
  const media = { startDate: { year: 2026, month: 1, day: 5 } };
  assert.equal(
    matchSeason(
      [
        { season_number: 0, air_date: "2026-01-05" },
        { season_number: 1, air_date: "2025-01-05" },
        { season_number: 2, air_date: "2026-01-06" },
      ],
      media,
    ),
    2,
  );
  assert.equal(
    matchSeason(
      [
        { season_number: 1, air_date: "2020-01-01" },
        { season_number: 2, air_date: "2021-01-01" },
      ],
      { startDate: { year: 2026 } },
    ),
    null,
  );
});
test("maps local cour numbers by matching air dates and keeps actual episode stills", () => {
  const rows = episodeRows(
    [
      {
        episode_number: 12,
        air_date: "2026-03-20",
        name: "Previous cour",
        still_path: "/wrong.jpg",
      },
      {
        episode_number: 13,
        air_date: "2026-04-06",
        name: "New cour",
        still_path: "/actual.jpg",
        runtime: 24,
      },
    ],
    { startDate: { year: 2026, month: 4, day: 5 }, episodes: 1 },
  );
  assert.equal(rows["1"].title, "New cour");
  assert.equal(rows["1"].image, "https://image.tmdb.org/t/p/w780/actual.jpg");
  assert.equal(rows["2"], undefined);
  assert.deepEqual(
    episodeRows(
      [{ episode_number: 1, air_date: "2020-01-01", still_path: "/wrong.jpg" }],
      { startDate: { year: 2026, month: 1, day: 1 } },
    ),
    {},
  );
});
