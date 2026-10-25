import {
  artworkLogos,
  fetchHeroArtwork,
  isTitleTreatment,
} from "./heroArtwork";
test("square and portrait covers cannot replace a hero title", () => {
  expect(isTitleTreatment(1024, 1024)).toBe(false);
  expect(isTitleTreatment(600, 900)).toBe(false);
  expect(isTitleTreatment(800, 310)).toBe(true);
  expect(isTitleTreatment(1, 0)).toBe(false);
});
const originalFetch = global.fetch;
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  global.fetch = originalFetch;
});
test("artwork requires the exact anime ID and excludes non-logo or untrusted images", () => {
  const payload = {
    mappings: { anilist_id: 42, imdb_id: "tt12345" },
    images: [
      { coverType: "Poster", url: "https://artworks.thetvdb.com/poster.png" },
      { coverType: "Clearlogo", url: "https://untrusted.example/logo.png" },
      { coverType: "Clearlogo", url: "https://artworks.thetvdb.com/logo.png" },
    ],
  };
  expect(artworkLogos(payload, 99)).toEqual([]);
  expect(artworkLogos(payload, 42)).toEqual([
    "https://images.metahub.space/logo/medium/tt12345/img",
    "https://artworks.thetvdb.com/logo.png",
  ]);
});
test("artwork requests deduplicate and reuse the successful cache", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      mappings: { anilist_id: 43, imdb_id: "tt12346" },
      images: [],
    }),
  });
  const [first, second] = await Promise.all([
    fetchHeroArtwork(43),
    fetchHeroArtwork(43),
  ]);
  expect(first).toEqual(second);
  expect(first[0]).toContain("tt12346");
  await fetchHeroArtwork(43);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("an unavailable source uses stale validated cache without overwriting it", async () => {
  const saved = {
    logos: ["https://artworks.thetvdb.com/stale.png"],
    updatedAt: Date.now() - 8 * 86400000,
  };
  localStorage.setItem("apex_hero_artwork_v1_44", JSON.stringify(saved));
  global.fetch = jest.fn().mockRejectedValue(new Error("Offline"));
  expect(await fetchHeroArtwork(44)).toEqual(saved.logos);
  expect(JSON.parse(localStorage.getItem("apex_hero_artwork_v1_44")!)).toEqual(
    saved,
  );
});
