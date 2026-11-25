jest.mock("./anilistBudget", () => ({ acquireAniListRequest: jest.fn() }));

import { fetchAnilist } from "./anilist";
import { acquireAniListRequest } from "./anilistBudget";

test("waits for the shared budget before calling the network", async () => {
  const order: string[] = [];
  (acquireAniListRequest as jest.Mock).mockImplementation(async () => {
    order.push("acquire");
  });
  global.fetch = jest.fn(async () => {
    order.push("fetch");
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: {} }),
    } as unknown as Response;
  }) as jest.Mock;
  await fetchAnilist("query {}", {}, undefined, "token-from-session");
  expect(order).toEqual(["acquire", "fetch"]);
});
