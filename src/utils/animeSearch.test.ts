jest.mock("./anilist", () => ({ fetchAnilist: jest.fn() }));

import { fetchAnilist } from "./anilist";
import { searchAnimeTitles } from "./animeSearch";

function pageWith(id: number) {
  return {
    media: [
      {
        id,
        idMal: id + 100,
        title: { english: "One Piece", romaji: "One Piece" },
        popularity: id,
      },
    ],
  };
}

test("asks for at most three aliases for a multi-word title", async () => {
  (fetchAnilist as jest.Mock).mockResolvedValue({
    q0: pageWith(1),
    q1: pageWith(2),
    q2: pageWith(3),
  });
  const results = await searchAnimeTitles("One Piece");
  const variables = (fetchAnilist as jest.Mock).mock.calls[0][1];
  expect(Object.keys(variables)).toEqual(["q0", "q1", "q2"]);
  expect(results.map((anime) => anime.id)).toContain(1);
});

test("reuses the final ranked results for five minutes", async () => {
  jest.useFakeTimers();
  try {
    (fetchAnilist as jest.Mock).mockReset().mockResolvedValue({ q0: pageWith(9) });
    await searchAnimeTitles("Cache Me");
    await searchAnimeTitles("cache me");
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(300_000);
    await searchAnimeTitles("Cache Me");
    expect(fetchAnilist).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test("does not cache failed searches", async () => {
  (fetchAnilist as jest.Mock)
    .mockReset()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ q0: pageWith(4) });
  await expect(searchAnimeTitles("No Cache")).rejects.toThrow("offline");
  await searchAnimeTitles("No Cache");
  expect(fetchAnilist).toHaveBeenCalledTimes(2);
});
