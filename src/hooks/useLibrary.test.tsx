import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useLibrary } from "./useLibrary";
let node: HTMLDivElement, root: Root, library: ReturnType<typeof useLibrary>;
const original = global.fetch;
function Harness({ anilist = true, mal = true }) {
  library = useLibrary({ anilist, mal });
  return null;
}
const anime = { id: 1, idMal: 11, title: { english: "Example" } };
const page = (identity: string, status: string, next = false) => ({
  identity,
  name: identity,
  hasNextPage: next,
  entries: [{ anime, status, progress: 3, updatedAt: 1 }],
});
beforeEach(() => {
  node = document.createElement("div");
  root = createRoot(node);
  localStorage.clear();
});
afterEach(() => {
  act(() => root.unmount());
  global.fetch = original;
});
test("imports every page, retains successful provider when another fails, and records only confirmed updates", async () => {
  global.fetch = jest.fn(async (url) =>
    String(url).includes("/mal")
      ? { ok: false, json: async () => ({ error: "MAL unavailable" }) }
      : {
          ok: true,
          json: async () =>
            page("alice", "planning", String(url).endsWith("page=1")),
        },
  ) as jest.Mock;
  await act(async () => {
    root.render(<Harness />);
  });
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/list/anilist?page=2",
    expect.anything(),
  );
  expect(library.libraryEntries).toHaveLength(2);
  expect(library.libraryErrors.mal).toBe("MAL unavailable");
  act(() => library.record("anilist", anime, "watching", 4));
  expect(library.getListStatus(anime)).toBe("watching");
  expect(
    JSON.parse(localStorage.getItem("apex_library_v1_anilist_alice")!)
      .entries[0].progress,
  ).toBe(4);
  await act(async () => {
    root.render(<Harness anilist={false} mal={false} />);
  });
  expect(library.libraryEntries).toHaveLength(0);
});
test("an account change cannot expose a previous account cache", async () => {
  localStorage.setItem(
    "apex_library_v1_anilist_alice",
    JSON.stringify({
      identity: "alice",
      entries: [{ anime, status: "completed" }],
    }),
  );
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ ...page("bob", "planning"), entries: [] }),
  })) as jest.Mock;
  await act(async () => {
    root.render(<Harness mal={false} />);
  });
  expect(library.libraryEntries).toHaveLength(0);
  expect(library.lists.anilist?.identity).toBe("bob");
});
