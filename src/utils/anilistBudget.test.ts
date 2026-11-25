import { createAniListBudget } from "./anilistBudget";

test("allows 24 starts in a rolling minute then delays the next start", async () => {
  let now = 0;
  const delays: number[] = [];
  const budget = createAniListBudget({
    now: () => now,
    wait: async (ms) => {
      delays.push(ms);
      now += ms;
    },
  });
  await Promise.all(Array.from({ length: 25 }, () => budget.acquire()));
  expect(delays[0]).toBe(0);
  expect(delays.slice(1, 24)).toEqual(Array(23).fill(1000));
  expect(delays[24]).toBe(37000);
});

test("stops an aborted waiter without consuming a slot", async () => {
  const controller = new AbortController();
  const budget = createAniListBudget({
    now: () => 0,
    wait: (_ms, signal) => {
      if (!signal) return Promise.resolve();
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      );
    },
  });
  await budget.acquire();
  const pending = budget.acquire(controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});
