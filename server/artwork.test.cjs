const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectImages, artwork } = require("./artwork.cjs");
test("English PNG logos and full HD language-neutral backdrops only", () => {
  const image = (file_path, iso_639_1, width = 1920, height = 1080) => ({
    file_path,
    iso_639_1,
    width,
    height,
  });
  const result = selectImages({
    logos: [
      image("/english.png", "en", 800, 300),
      image("/japanese.png", "ja", 800, 300),
      image("/english.jpg", "en"),
    ],
    backdrops: [
      image("/clean.jpg", null),
      image("/text.jpg", "en"),
      image("/tiny.jpg", null, 640, 360),
      image("/4k.jpg", null, 3840, 2160),
    ],
  });
  assert.deepEqual(result.logos, [
    "https://image.tmdb.org/t/p/original/english.png",
  ]);
  assert.deepEqual(result.backdrops, [
    "https://image.tmdb.org/t/p/original/4k.jpg",
    "https://image.tmdb.org/t/p/original/clean.jpg",
  ]);
});
test("mapped movie uses movie images; concurrent calls deduplicate", async () => {
  const oldFetch = global.fetch,
    oldKey = process.env.TMDB_API_KEY;
  const calls = [];
  process.env.TMDB_API_KEY = "test";
  global.fetch = async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () =>
        url.includes("ani.zip")
          ? { mappings: { anilist_id: 999, type: "MOVIE", themoviedb_id: 12 } }
          : { logos: [], backdrops: [] },
    };
  };
  try {
    const [a, b] = await Promise.all([artwork(999), artwork(999)]);
    assert.deepEqual(a, b);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /movie\/12\/images/);
    assert.equal(JSON.stringify(a).includes("test"), false);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = oldKey;
  }
});
