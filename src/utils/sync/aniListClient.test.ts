jest.mock("../anilistAuth", () => ({
  anilistRequest: jest.fn(),
  getAniListToken: jest.fn().mockResolvedValue({ accessToken: "token-from-session" }),
  clearAniListToken: jest.fn(),
}));

import {
  anilistRequest,
  clearAniListToken,
  getAniListToken,
} from "../anilistAuth";
import { aniListClient } from "./aniListClient";

beforeEach(() => {
  jest.clearAllMocks();
  (getAniListToken as jest.Mock).mockResolvedValue({
    accessToken: "token-from-session",
  });
  global.fetch = jest.fn();
});

test("legacy client sends progress through direct AniList request", async () => {
  (anilistRequest as jest.Mock).mockResolvedValue({
    SaveMediaListEntry: { id: 5, progress: 12, status: "COMPLETED" },
  });
  const result = await aniListClient.updateAnimeProgress(10, 12, 12);
  expect(result.success).toBe(true);
  expect(anilistRequest).toHaveBeenCalledWith(
    expect.stringContaining("SaveMediaListEntry"),
    { mediaId: 10, progress: 12, status: "COMPLETED" },
    undefined,
  );
});

test("legacy client keeps CURRENT status when progress is below the total", async () => {
  (anilistRequest as jest.Mock).mockResolvedValue({
    SaveMediaListEntry: { id: 5, progress: 3, status: "CURRENT" },
  });
  const result = await aniListClient.updateAnimeProgress(10, 3, 12);
  expect(result.success).toBe(true);
  expect((anilistRequest as jest.Mock).mock.calls[0][1]).toEqual({
    mediaId: 10,
    progress: 3,
    status: "CURRENT",
  });
});

test("legacy authenticate reports browser token availability", async () => {
  await expect(aniListClient.authenticate()).resolves.toBe(true);
  (getAniListToken as jest.Mock).mockRejectedValueOnce(new Error("not connected"));
  await expect(aniListClient.authenticate()).resolves.toBe(false);
});

test("legacy logout clears the browser AniList token", () => {
  aniListClient.logout();
  expect(clearAniListToken).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith("/api/oauth/anilist/logout", {
    method: "POST",
  });
});
