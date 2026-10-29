import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { fetchEpisodeMetadata } from "../utils/episodeMetadata";
import { DetailEpisodes } from "./DetailEpisodes";
import { fetchEpisodeAvailability } from "../utils/episodeAvailability";
import type { useAccounts } from "../hooks/useAccounts";
jest.mock("../utils/episodeMetadata", () => ({
  fetchEpisodeMetadata: jest.fn().mockResolvedValue({}),
}));
jest.mock("../utils/episodeAvailability");
test("language filters show only confirmed available episode numbers and preserve sparse dub numbering", async () => {
  (fetchEpisodeMetadata as jest.Mock).mockResolvedValue({});
  (fetchEpisodeAvailability as jest.Mock).mockResolvedValue({
    sub: [1, 2, 3],
    dub: [1, 3],
    at: Date.now(),
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    select = jest.fn(),
    language = jest.fn();
  try {
    await act(async () =>
      root.render(
        <DetailEpisodes
          anime={{ id: 10, title: { english: "Example" } }}
          total={3}
          selected={2}
          accounts={
            {
              libraryEntries: [],
              libraryLoading: false,
            } as unknown as ReturnType<typeof useAccounts>
          }
          onSelect={select}
          onLanguage={language}
        />,
      ),
    );
    const dub = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "Dub only 2",
    )!;
    act(() => dub.click());
    expect(language).toHaveBeenCalledWith("dub");
    expect(select).toHaveBeenCalledWith(1);
    expect(host.querySelectorAll(".detail-episode-card")).toHaveLength(2);
    expect(
      host.querySelector('[aria-label="Episode 2, not marked watched"]'),
    ).toBeNull();
    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Episode numbers"]')!
        .click(),
    );
    expect(host.querySelectorAll(".episode-cell")).toHaveLength(2);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
