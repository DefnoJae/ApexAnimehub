import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import WatchOrder, { graphLayout } from "./WatchOrder";
import { fetchWatchOrder, OrderGraph } from "../utils/watchOrder";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("../utils/watchOrder", () => ({ fetchWatchOrder: jest.fn() }));
const graph: OrderGraph = {
  nodes: [
    {
      id: 1,
      idMal: 11,
      title: { english: "First season" },
      episodes: 12,
      coverImage: { extraLarge: "/poster1.jpg" },
    },
    {
      id: 2,
      title: { english: "Next season" },
      episodes: 10,
      coverImage: { extraLarge: "/poster2.jpg" },
    },
  ],
  edges: [{ from: 1, to: 2, relation: "SEQUEL" }],
};
test("layout has finite positions and preserves edges even with cycles", () => {
  const result = graphLayout({
    ...graph,
    edges: [...graph.edges, { from: 2, to: 1, relation: "ALTERNATIVE" }],
  });
  expect(result.width).toBeGreaterThan(0);
  expect(
    result.nodes.every(
      (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
    ),
  ).toBe(true);
  expect(result.edges).toHaveLength(2);
});
test("poster navigation uses imported progress and never writes to connected lists", async () => {
  (fetchWatchOrder as jest.Mock).mockResolvedValue(graph);
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const onSelect = jest.fn(),
    sync = jest.fn(),
    close = jest.fn();
  const accounts = {
    libraryEntries: [
      { anime: { idMal: 11 }, status: "completed", progress: 12 },
    ],
    sync,
  } as unknown as ReturnType<typeof useAccounts>;
  try {
    await act(async () =>
      root.render(
        <WatchOrder
          anime={graph.nodes[0]}
          accounts={accounts}
          onSelect={onSelect}
          onClose={close}
        />,
      ),
    );
    expect(node.querySelectorAll(".watch-order-node img")).toHaveLength(2);
    expect(node.textContent).toContain("Completed 12/12");
    const next = node.querySelector(
      '[aria-label="Open Next season details"]',
    ) as HTMLButtonElement;
    act(() => next.click());
    expect(onSelect).toHaveBeenCalledWith(graph.nodes[1]);
    expect(sync).not.toHaveBeenCalled();
    act(() =>
      (
        node.querySelector(
          '[aria-label="Close watch order"]',
        ) as HTMLButtonElement
      ).click(),
    );
    expect(close).toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    node.remove();
  }
});
