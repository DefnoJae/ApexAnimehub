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
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2400));
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
  act(() =>
    library.record("anilist", anime, "watching", 1, {
      manualProgress: true,
      score: 8.5,
    }),
  );
  expect(library.libraryEntries[0]).toMatchObject({ progress: 1, score: 8.5 });
  act(() => library.record("anilist", anime, "watching", 2));
  expect(library.libraryEntries[0]).toMatchObject({ progress: 2, score: 8.5 });
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
test("resumes a verified account checkpoint instead of restarting a large import", async () => {
  localStorage.setItem(
    "apex_library_v1_anilist_alice",
    JSON.stringify({
      identity: "alice",
      name: "alice",
      entries: [{ anime, status: "planning", progress: 0, updatedAt: 1 }],
      complete: false,
      nextPage: 30,
      updatedAt: Date.now(),
    }),
  );
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => ({
      ...page("alice", "planning"),
      entries: [],
      hasNextPage: String(url).endsWith("page=1"),
    }),
  })) as jest.Mock;
  await act(async () => {
    root.render(<Harness mal={false} />);
  });
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/list/anilist?page=30",
    expect.anything(),
  );
  expect(library.libraryEntries).toHaveLength(1);
  expect(library.lists.anilist?.complete).toBe(true);
});

test("confirmed status, progress and rating survive stale reimports and reload", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => page("alice", "planning"),
  })) as jest.Mock;
  await act(async () => root.render(<Harness mal={false} />));
  act(() =>
    library.record("anilist", anime, "completed", 12, {
      manualProgress: true,
      score: 9,
    }),
  );
  await act(async () => {
    await library.refreshLibrary();
  });
  expect(library.libraryEntries[0]).toMatchObject({
    status: "completed",
    progress: 12,
    score: 9,
  });
  expect(
    JSON.parse(localStorage.getItem("apex_library_v1_anilist_alice")!)
      .entries[0],
  ).toMatchObject({ status: "completed", progress: 12, score: 9 });
  // Simulate an old saved snapshot on a fresh mount; the confirmed-write journal repairs it.
  localStorage.setItem(
    "apex_library_v1_anilist_alice",
    JSON.stringify({ ...page("alice", "planning"), complete: true }),
  );
  act(() => root.unmount());
  root = createRoot(node);
  await act(async () => root.render(<Harness mal={false} />));
  expect(library.libraryEntries[0]).toMatchObject({
    status: "completed",
    progress: 12,
    score: 9,
  });
  // Once the provider acknowledges the write, retire protection so external edits can be imported.
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      ...page("alice", "completed"),
      entries: [
        {
          anime,
          status: "completed",
          progress: 12,
          score: 9,
          updatedAt: Date.now(),
        },
      ],
    }),
  })) as jest.Mock;
  await act(async () => {
    await library.refreshLibrary();
  });
  expect(
    JSON.parse(localStorage.getItem("apex_library_changes_v1_anilist_alice")!),
  ).toEqual([]);
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => page("alice", "paused"),
  })) as jest.Mock;
  await act(async () => {
    await library.refreshLibrary();
  });
  expect(library.getListStatus(anime)).toBe("paused");
});
test("confirmed removals cannot be resurrected by stale imports", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => page("alice", "planning"),
  })) as jest.Mock;
  await act(async () => root.render(<Harness mal={false} />));
  act(() => library.removeRecord("anilist", anime));
  await act(async () => {
    await library.refreshLibrary();
  });
  expect(library.libraryEntries).toHaveLength(0);
});

test("fresh first-page values replace old complete cache before a large import finishes", async () => {
  localStorage.setItem(
    "apex_library_v1_anilist_alice",
    JSON.stringify({
      identity: "alice",
      name: "alice",
      complete: true,
      entries: [
        { anime, status: "planning", progress: 0, updatedAt: 1 },
        { anime: { id: 2 }, status: "watching", progress: 5, updatedAt: 1 },
      ],
    }),
  );
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => page("alice", "completed", true),
  })) as jest.Mock;
  await act(async () => root.render(<Harness mal={false} />));
  expect(library.getListStatus(anime)).toBe("completed");
  expect(library.libraryEntries.some((entry) => entry.anime.id === 2)).toBe(
    true,
  );
  expect(
    JSON.parse(localStorage.getItem("apex_library_v1_anilist_alice")!).entries,
  ).toHaveLength(2);
});
