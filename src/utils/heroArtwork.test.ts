import {
  artworkLogos,
  artworkBackdrops,
  fetchHeroArtwork,
  fetchHeroBackdrops,
  isTitleTreatment,
  isHeroBackdrop,
} from "./heroArtwork";
const originalFetch = global.fetch;
beforeEach(() => localStorage.clear());
afterEach(() => {
  global.fetch = originalFetch;
});
test("only matching TMDB image payloads are accepted", () => {
  const data = {
    anilistId: 42,
    logos: [
      "https://image.tmdb.org/t/p/original/logo.png",
      "https://untrusted.example/logo.png",
    ],
    backdrops: ["https://image.tmdb.org/t/p/original/backdrop.jpg"],
  };
  expect(artworkLogos(data, 42)).toEqual([data.logos[0]]);
  expect(artworkLogos(data, 43)).toEqual([]);
  expect(artworkBackdrops(data, 42)).toEqual(data.backdrops);
  expect(isTitleTreatment(600, 900)).toBe(true);
  expect(isTitleTreatment(500, 500)).toBe(true);
  expect(isTitleTreatment(10, 10)).toBe(false);
  expect(isTitleTreatment(800, 310)).toBe(true);
  expect(isHeroBackdrop(3840, 2160)).toBe(true);
  expect(isHeroBackdrop(640, 360)).toBe(false);
});
test("logo and backdrop requests share server fetch and daily cache", async () => {
  const data = {
    anilistId: 43,
    logos: ["https://image.tmdb.org/t/p/original/logo.png"],
    backdrops: ["https://image.tmdb.org/t/p/original/bg.jpg"],
  };
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => data });
  const [logos, backdrops] = await Promise.all([
    fetchHeroArtwork(43),
    fetchHeroBackdrops(43),
  ]);
  expect(logos).toEqual(data.logos);
  expect(backdrops).toEqual(data.backdrops);
  await fetchHeroArtwork(43);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/artwork?anilist_id=43&v=7",
    expect.anything(),
  );
});
test("provider outage preserves stale TMDB artwork", async () => {
  const saved = {
    logos: ["https://image.tmdb.org/t/p/original/stale.png"],
    backdrops: [],
    updatedAt: Date.now() - 2 * 86400000,
  };
  localStorage.setItem("apex_tmdb_artwork_v7_44", JSON.stringify(saved));
  global.fetch = jest.fn().mockRejectedValue(new Error("Offline"));
  expect(await fetchHeroArtwork(44)).toEqual(saved.logos);
  expect(JSON.parse(localStorage.getItem("apex_tmdb_artwork_v7_44")!)).toEqual(
    saved,
  );
});

test("prequel-first cache is discarded and the exact artwork is fetched", async () => {
  localStorage.setItem(
    "apex_tmdb_artwork_v5_45",
    JSON.stringify({
      logos: ["https://image.tmdb.org/t/p/original/wrong.png"],
      backdrops: [],
      updatedAt: Date.now(),
    }),
  );
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      anilistId: 45,
      logos: ["https://image.tmdb.org/t/p/original/exact.png"],
      backdrops: [],
      match: "exact",
    }),
  });
  expect(await fetchHeroArtwork(45)).toEqual([
    "https://image.tmdb.org/t/p/original/exact.png",
  ]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("an empty old lookup is rechecked instead of hiding an available logo", async () => {
  localStorage.setItem(
    "apex_tmdb_artwork_v6_46",
    JSON.stringify({
      logos: [],
      backdrops: [],
      updatedAt: Date.now(),
      match: "fallback",
    }),
  );
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        anilistId: 46,
        match: "exact",
        logos: ["https://image.tmdb.org/t/p/original/restored.png"],
        backdrops: [],
      }),
    });
  expect(await fetchHeroArtwork(46)).toEqual([
    "https://image.tmdb.org/t/p/original/restored.png",
  ]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("a transient lookup miss never replaces a previously verified clear logo", async () => {
  const saved = {
    logos: ["https://image.tmdb.org/t/p/original/verified.png"],
    backdrops: [],
    updatedAt: Date.now() - 86400000,
    match: "exact",
  };
  localStorage.setItem("apex_tmdb_artwork_v7_47", JSON.stringify(saved));
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        anilistId: 47,
        match: "none",
        logos: [],
        backdrops: [],
      }),
    });
  expect(await fetchHeroArtwork(47)).toEqual(saved.logos);
  expect(JSON.parse(localStorage.getItem("apex_tmdb_artwork_v7_47")!)).toEqual(
    saved,
  );
});
