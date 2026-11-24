import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { RatingPills } from "./RatingPills";
import { useRatingSource, RatingSource } from "../hooks/useRatingSource";
import { fetchAnilist } from "../utils/anilist";
jest.mock("../utils/anilist", () => ({ fetchAnilist: jest.fn() }));
test("rating source updates immediately, remembers the choice, and uses logo-only provider labels", async () => {
  localStorage.clear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Harness() {
    const [source, setSource] = useRatingSource();
    return (
      <>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as RatingSource)}
        >
          <option value="anilist">AniList</option>
          <option value="mal">MAL</option>
          <option value="both">Both</option>
        </select>
        <RatingPills id={10} idMal={20} averageScore={85} malScore={8.2} />
      </>
    );
  }
  try {
    await act(async () => root.render(<Harness />));
    expect(host.querySelector(".public-rating-pill")?.textContent).toBe("8.5");
    act(() => {
      host.querySelector("select")!.value = "mal";
      host
        .querySelector("select")!
        .dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector(".rating-mal")?.textContent).toBe("8.2");
    expect(host.querySelector(".rating-anilist")).toBeNull();
    expect(localStorage.getItem("apex_rating_source_v1")).toBe("mal");
    act(() => {
      host.querySelector("select")!.value = "both";
      host
        .querySelector("select")!
        .dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelectorAll(".rating-brand")).toHaveLength(2);
  } finally {
    act(() => root.unmount());
    host.remove();
    localStorage.clear();
  }
});

test("home hover uses the selected provider score without a logo pill", async () => {
  localStorage.setItem("apex_rating_source_v1", "mal");
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <RatingPills
          asText
          active={false}
          id={10}
          idMal={20}
          averageScore={85}
          malScore={7.4}
        />,
      ),
    );
    expect(host.querySelector(".poster-rating-number")?.textContent).toBe(
      "7.4",
    );
    expect(host.querySelector(".rating-brand")).toBeNull();
    expect(host.querySelector(".public-rating-pill")).toBeNull();
    expect(
      host.querySelector(".poster-rating-number")?.getAttribute("aria-label"),
    ).toBe("MyAnimeList rating 7.4");
  } finally {
    act(() => root.unmount());
    localStorage.clear();
  }
});

test("poster metadata shows only a star and the preferred score", async () => {
  localStorage.setItem("apex_rating_source_v1", "mal");
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <RatingPills
          showBrand={false}
          id={10}
          idMal={20}
          averageScore={85}
          malScore={7.4}
        />,
      ),
    );
    expect(host.querySelector(".poster-rating-number")?.textContent).toBe(
      "7.4",
    );
    expect(host.querySelector(".poster-rating-number svg")).not.toBeNull();
    expect(host.querySelector(".rating-brand")).toBeNull();
    expect(host.querySelector(".public-rating-pill")).toBeNull();
  } finally {
    act(() => root.unmount());
    localStorage.clear();
  }
});

test("does not re-fetch a score that the catalog already checked", async () => {
  localStorage.setItem("apex_rating_source_v1", "anilist");
  (fetchAnilist as jest.Mock).mockResolvedValue({ Media: { averageScore: null } });
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <RatingPills id={10} idMal={20} anilistScoreKnown />,
      ),
    );
    expect(fetchAnilist).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    localStorage.clear();
    jest.clearAllMocks();
  }
});

test("does not cache rate-limit failures; retries on re-mount", async () => {
  localStorage.setItem("apex_rating_source_v1", "anilist");
  (fetchAnilist as jest.Mock).mockRejectedValueOnce(
    new Error("AniList rate limit reached. Please try again later."),
  );
  const host1 = document.createElement("div");
  document.body.append(host1);
  const root1 = createRoot(host1);
  try {
    await act(async () =>
      root1.render(<RatingPills id={10} idMal={20} />),
    );
    expect(fetchAnilist).toHaveBeenCalledTimes(1);
    act(() => root1.unmount());
    (fetchAnilist as jest.Mock).mockResolvedValue({
      Media: { averageScore: 85 },
    });
    const host2 = document.createElement("div");
    document.body.append(host2);
    const root2 = createRoot(host2);
    try {
      await act(async () =>
        root2.render(<RatingPills id={10} idMal={20} />),
      );
      expect(fetchAnilist).toHaveBeenCalledTimes(2);
    } finally {
      act(() => root2.unmount());
      host2.remove();
    }
  } finally {
    act(() => root1.unmount());
    host1.remove();
    localStorage.clear();
    jest.clearAllMocks();
  }
});
