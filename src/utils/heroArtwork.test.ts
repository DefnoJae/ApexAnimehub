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
  expect(isTitleTreatment(600, 900)).toBe(false);
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
    "/api/artwork?anilist_id=43",
    expect.anything(),
  );
});
test("provider outage preserves stale TMDB artwork", async () => {
  const saved = {
    logos: ["https://image.tmdb.org/t/p/original/stale.png"],
    backdrops: [],
    updatedAt: Date.now() - 2 * 86400000,
  };
  localStorage.setItem("apex_tmdb_artwork_v1_44", JSON.stringify(saved));
  global.fetch = jest.fn().mockRejectedValue(new Error("Offline"));
  expect(await fetchHeroArtwork(44)).toEqual(saved.logos);
  expect(JSON.parse(localStorage.getItem("apex_tmdb_artwork_v1_44")!)).toEqual(
    saved,
  );
});
