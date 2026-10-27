import { fetchAnilist } from "./anilist";
import { fetchWatchOrder, orderEdges, OrderAnime } from "./watchOrder";
jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));
const fetchMock = fetchAnilist as jest.Mock;
const anime = (id: number): OrderAnime => ({
  id,
  type: "ANIME",
  title: { english: `Anime ${id}` },
});
beforeEach(() => fetchMock.mockReset());
test("inverse sequel and parent links deduplicate, excluding self links and manga", () => {
  const a = anime(1),
    b = anime(2),
    c = anime(3);
  a.relations = {
    edges: [
      { relationType: "SEQUEL", node: b },
      { relationType: "SIDE_STORY", node: c },
      { relationType: "ADAPTATION", node: b },
      { relationType: "SEQUEL", node: a },
    ],
  };
  b.relations = { edges: [{ relationType: "PREQUEL", node: a }] };
  c.relations = { edges: [{ relationType: "PARENT", node: a }] };
  expect(orderEdges([a, b, c])).toEqual([
    { from: 1, to: 2, relation: "SEQUEL" },
    { from: 1, to: 3, relation: "SIDE_STORY" },
  ]);
});
test("traversal handles cycles, filters non-anime, caches public data, and aborts", async () => {
  const a = anime(101),
    b = anime(102),
    manga = { ...anime(103), type: "MANGA" };
  a.relations = {
    edges: [
      { relationType: "SEQUEL", node: b },
      { relationType: "SIDE_STORY", node: manga },
    ],
  };
  b.relations = { edges: [{ relationType: "PREQUEL", node: a }] };
  fetchMock
    .mockResolvedValueOnce({ Page: { media: [a] } })
    .mockResolvedValueOnce({ Page: { media: [b] } });
  const result = await fetchWatchOrder(a, new AbortController().signal);
  expect(result.nodes.map((node) => node.id)).toEqual([101, 102]);
  expect(result.edges).toHaveLength(1);
  expect(fetchMock.mock.calls[1][1]).toEqual({ ids: [102] });
  await fetchWatchOrder(a, new AbortController().signal);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const abort = new AbortController();
  abort.abort();
  await expect(fetchWatchOrder(anime(999), abort.signal)).rejects.toBeDefined();
});
test("partial fetch failure preserves available nodes and offers a retry without caching failures", async () => {
  const a = anime(201),
    b = anime(202);
  a.relations = { edges: [{ relationType: "SEQUEL", node: b }] };
  fetchMock
    .mockResolvedValueOnce({ Page: { media: [a] } })
    .mockRejectedValueOnce(new Error("Rate limit reached"));
  const result = await fetchWatchOrder(a, new AbortController().signal);
  expect(result.nodes).toHaveLength(2);
  expect(result.warning).toBe("Rate limit reached");
  fetchMock.mockRejectedValueOnce(new Error("Offline"));
  await expect(
    fetchWatchOrder(a, new AbortController().signal),
  ).rejects.toThrow("Offline");
});
