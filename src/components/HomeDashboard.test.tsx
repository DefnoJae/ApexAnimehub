import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
  HomeDashboard,
  QuickList,
  FloatingNavigation,
  LatestEpisodes,
} from "./HomeDashboard";
import { useAccounts } from "../hooks/useAccounts";
import { fetchAnilist } from "../utils/anilist";
import { fetchDubRange } from "../utils/dubSchedule";
import {
  fetchHeroArtwork,
  fetchHeroBackdrops,
  isTitleTreatment,
  isHeroBackdrop,
} from "../utils/heroArtwork";
import { HeroBackdrop } from "./HeroBackdrop";
jest.mock("../utils/anilist");
jest.mock("../utils/dubSchedule");
jest.mock("../utils/heroArtwork");
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const anime = {
  id: 42,
  idMal: 84,
  title: { english: "Example anime" },
  episodes: 12,
};
let node: HTMLDivElement, root: Root;
beforeEach(() => {
  (isHeroBackdrop as jest.Mock).mockImplementation(
    (width: number, height: number) =>
      width >= 1280 &&
      height >= 720 &&
      width / height >= 1.5 &&
      width / height <= 2.4,
  );
  (fetchHeroBackdrops as jest.Mock).mockResolvedValue([]);
  (isTitleTreatment as jest.Mock).mockImplementation(
    (width: number, height: number) => width / height >= 1.5,
  );
  (fetchHeroArtwork as jest.Mock).mockResolvedValue([]);
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  localStorage.clear();
  (fetchAnilist as jest.Mock).mockResolvedValue({
    Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] },
  });
  (fetchDubRange as jest.Mock).mockResolvedValue({
    entries: [],
    cached: false,
    updatedAt: null,
  });
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
});
function fakeAccounts() {
  return {
    checking: false,
    busy: false,
    message: "",
    results: [],
    sync: jest.fn().mockResolvedValue([{ provider: "anilist", success: true }]),
  } as unknown as ReturnType<typeof useAccounts>;
}

test("a mislabeled square poster stays hidden and leaves a readable hero title", async () => {
  (fetchHeroArtwork as jest.Mock).mockResolvedValue([
    "https://artworks.thetvdb.com/bad-cover.png",
  ]);
  await act(async () => {
    root.render(
      <HomeDashboard
        slides={[anime]}
        rows={[]}
        history={[]}
        accounts={fakeAccounts()}
        onSelect={jest.fn()}
        onWatch={jest.fn()}
        onResume={jest.fn()}
        onRemove={jest.fn()}
        onCalendar={jest.fn()}
      />,
    );
  });
  const image = node.querySelector("h1 img") as HTMLImageElement;
  expect(image.style.display).toBe("none");
  expect(node.querySelector("h1")?.textContent).toBe(""); // No text flash while the logo is being validated.
  Object.defineProperties(image, {
    naturalWidth: { value: 1024 },
    naturalHeight: { value: 1024 },
  });
  act(() => image.dispatchEvent(new Event("load")));
  expect(node.querySelector("h1 img")).toBeNull();
  expect(node.querySelector("h1")?.textContent).toBe("Example anime");
});

test("backdrop rejects thin banners and displays a verified HD landscape", async () => {
  (fetchHeroBackdrops as jest.Mock).mockResolvedValue([
    "https://artworks.thetvdb.com/thin.jpg",
    "https://artworks.thetvdb.com/hd.jpg",
  ]);
  await act(async () => {
    root.render(<HeroBackdrop anime={anime} />);
  });
  let image = node.querySelector(".hero-backdrop") as HTMLImageElement;
  Object.defineProperties(image, {
    naturalWidth: { value: 1920 },
    naturalHeight: { value: 400 },
  });
  act(() => image.dispatchEvent(new Event("load")));
  image = node.querySelector(".hero-backdrop") as HTMLImageElement;
  expect(image.src).toContain("hd.jpg");
  expect(image.style.opacity).toBe("0");
  Object.defineProperties(image, {
    naturalWidth: { value: 1920 },
    naturalHeight: { value: 1080 },
  });
  act(() => image.dispatchEvent(new Event("load")));
  expect(image.style.opacity).toBe("1");
  expect(node.querySelector(".hero-poster-fallback")).toBeNull();
});

test("carousel progresses again after manual dot selection instead of permanently stopping", async () => {
  jest.useFakeTimers();
  const visibility = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  try {
    await act(async () => {
      root.render(
        <HomeDashboard
          slides={[
            anime,
            { ...anime, id: 43, title: { english: "Second anime" } },
          ]}
          rows={[]}
          history={[]}
          accounts={fakeAccounts()}
          onSelect={jest.fn()}
          onWatch={jest.fn()}
          onResume={jest.fn()}
          onRemove={jest.fn()}
          onCalendar={jest.fn()}
        />,
      );
    });
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(
      node
        .querySelector('[aria-label="Show Second anime"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    act(() =>
      (
        node.querySelector(
          '[aria-label="Show Example anime"]',
        ) as HTMLButtonElement
      ).click(),
    );
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(
      node
        .querySelector('[aria-label="Show Second anime"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  } finally {
    if (visibility) Object.defineProperty(document, "hidden", visibility);
    else delete (document as unknown as { hidden?: boolean }).hidden;
    jest.useRealTimers();
  }
});

test("hero tries alternative logo artwork and returns to text if both images fail", async () => {
  (fetchHeroArtwork as jest.Mock).mockResolvedValue([
    "https://images.metahub.space/logo/medium/tt123/img",
    "https://artworks.thetvdb.com/logo.png",
  ]);
  await act(async () => {
    root.render(
      <HomeDashboard
        slides={[anime]}
        rows={[]}
        history={[]}
        accounts={fakeAccounts()}
        onSelect={jest.fn()}
        onWatch={jest.fn()}
        onResume={jest.fn()}
        onRemove={jest.fn()}
        onCalendar={jest.fn()}
      />,
    );
  });
  expect(node.querySelector("h1 img")?.getAttribute("src")).toContain(
    "metahub",
  );
  act(() => node.querySelector("h1 img")!.dispatchEvent(new Event("error")));
  expect(node.querySelector("h1 img")?.getAttribute("src")).toContain(
    "thetvdb",
  );
  act(() => node.querySelector("h1 img")!.dispatchEvent(new Event("error")));
  expect(node.querySelector("h1 img")).toBeNull();
  expect(node.querySelector("h1")?.textContent).toBe("Example anime");
});
test("quick status actions preserve progress unless explicitly completing an anime", async () => {
  const accounts = fakeAccounts();
  act(() => root.render(<QuickList anime={anime} accounts={accounts} />));
  act(() =>
    (node.querySelector("[aria-expanded]") as HTMLButtonElement).click(),
  );
  await act(async () => {
    Array.from(node.querySelectorAll("button"))
      .find((button) => button.textContent === "Planning")!
      .click();
  });
  expect(accounts.sync).toHaveBeenLastCalledWith(anime, "planning", undefined);
  act(() =>
    (node.querySelector("[aria-expanded]") as HTMLButtonElement).click(),
  );
  await act(async () => {
    Array.from(node.querySelectorAll("button"))
      .find((button) => button.textContent === "Completed")!
      .click();
  });
  expect(accounts.sync).toHaveBeenLastCalledWith(anime, "completed", 12);
  expect(node.textContent).toContain("Saved");
});
test("continue watching shows actual playback progress and routes resume to the saved episode", async () => {
  const select = jest.fn(),
    resume = jest.fn(),
    remove = jest.fn(),
    entry = {
      anime,
      episode: 3,
      streamName: "MegaPlay (Dub)",
      timestamp: 1,
      position: 300,
      duration: 1200,
    };
  await act(async () => {
    root.render(
      <HomeDashboard
        slides={[anime]}
        rows={[]}
        history={[entry]}
        accounts={fakeAccounts()}
        onSelect={select}
        onWatch={jest.fn()}
        onResume={resume}
        onRemove={remove}
        onCalendar={jest.fn()}
      />,
    );
  });
  expect(
    node.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
  ).toBe("25");
  act(() =>
    (
      node.querySelector(
        '[aria-label="Resume Example anime episode 3"]',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(resume).toHaveBeenCalledWith(entry);
  const titleButtons = node.querySelectorAll(
    '[aria-label="View anime details: Example anime"]',
  );
  expect(titleButtons).toHaveLength(2);
  expect(node.querySelector("button button")).toBeNull();
  act(() => {
    (titleButtons[0] as HTMLButtonElement).click();
    (titleButtons[1] as HTMLButtonElement).click();
  });
  expect(select).toHaveBeenCalledTimes(2);
  expect(select).toHaveBeenLastCalledWith(anime);
  expect(resume).toHaveBeenCalledTimes(1);
  expect(node.querySelector(".continue-info .episode-badge")?.textContent).toBe(
    "EP 3",
  );
  expect(node.querySelector(".continue-art .episode-badge")).toBeNull();
  act(() =>
    (
      node.querySelector(
        '[aria-label="Remove Example anime from Continue Watching"]',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(remove).toHaveBeenCalledWith(anime.id);
  expect(resume).toHaveBeenCalledTimes(1);
  await act(async () => {
    Array.from(node.querySelectorAll("button"))
      .find((button) => button.textContent === "Dub")!
      .click();
  });
  expect(localStorage.getItem("apex_episode_language")).toBe("dub");
  expect(fetchDubRange).toHaveBeenCalled();
});
test("navigation exposes accessible labels, active location and independent search/settings actions", () => {
  const view = jest.fn(),
    search = jest.fn(),
    settings = jest.fn();
  act(() =>
    root.render(
      <FloatingNavigation
        view="all"
        hidden={false}
        onView={view}
        onSearch={search}
        onSettings={settings}
      />,
    ),
  );
  expect(
    node.querySelector('[aria-label="Home"]')?.getAttribute("aria-current"),
  ).toBe("page");
  act(() =>
    (
      node.querySelector('[aria-label="Dub calendar"]') as HTMLButtonElement
    ).click(),
  );
  expect(view).toHaveBeenCalledWith("dub-releases");
  act(() =>
    (
      node.querySelector('[aria-label="Search anime"]') as HTMLButtonElement
    ).click(),
  );
  act(() =>
    (
      node.querySelector('[aria-label="Account settings"]') as HTMLButtonElement
    ).click(),
  );
  expect(search).toHaveBeenCalledTimes(1);
  expect(settings).toHaveBeenCalledTimes(1);
});

test("latest releases show local dates and open the exact episode without opening the calendar", async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const onSelect = jest.fn(),
    onCalendar = jest.fn();
  (fetchAnilist as jest.Mock).mockResolvedValue({
    Page: {
      pageInfo: { hasNextPage: false },
      airingSchedules: [
        { episode: 7, airingAt: Math.floor(+today / 1000), media: anime },
      ],
    },
  });
  await act(async () =>
    root.render(
      <LatestEpisodes
        language="sub"
        setLanguage={jest.fn()}
        onSelect={onSelect}
        onCalendar={onCalendar}
      />,
    ),
  );
  const card = node.querySelector<HTMLButtonElement>(".episode-card")!;
  expect(card.querySelector("time")?.getAttribute("dateTime")).toBe(
    today.toISOString(),
  );
  act(() => card.click());
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: 42, releaseEpisode: 7 }),
  );
  expect(onCalendar).not.toHaveBeenCalled();
});

test("Home refresh renders saved Continue Watching before hero data arrives and uses each card's own rating", async () => {
  const accounts = {
    ...fakeAccounts(),
    libraryEntries: [
      {
        provider: "anilist",
        anime,
        status: "watching",
        score: 9,
        progress: 3,
        updatedAt: 1,
      },
    ],
  } as ReturnType<typeof useAccounts>;
  const history = [
    { anime, episode: 3, streamName: "Ani.pm (Dub)", timestamp: 1 },
  ];
  const props = {
    rows: [],
    history,
    accounts,
    onSelect: jest.fn(),
    onWatch: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
    onCalendar: jest.fn(),
  };
  await act(async () => root.render(<HomeDashboard {...props} slides={[]} />));
  expect(node.querySelector(".continue-card")).not.toBeNull();
  expect(
    node.querySelectorAll(".continue-card .personal-rating-pill"),
  ).toHaveLength(1);
  expect(
    node
      .querySelector(".continue-art .personal-rating-pill")
      ?.getAttribute("aria-label"),
  ).toBe("Your rating: 9/10");
  await act(async () =>
    root.render(
      <HomeDashboard
        {...props}
        slides={[{ ...anime, id: 100, title: { english: "Different hero" } }]}
      />,
    ),
  );
  expect(
    node.querySelectorAll(".continue-card .personal-rating-pill"),
  ).toHaveLength(1);
  expect(
    node
      .querySelector(".continue-art .personal-rating-pill")
      ?.getAttribute("aria-label"),
  ).toBe("Your rating: 9/10");
});
