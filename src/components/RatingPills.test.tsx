import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { RatingPills } from "./RatingPills";
import { useRatingSource, RatingSource } from "../hooks/useRatingSource";
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
