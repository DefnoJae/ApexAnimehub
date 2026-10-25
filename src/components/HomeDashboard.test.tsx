import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { HomeDashboard, QuickList, FloatingNavigation } from "./HomeDashboard";
import { useAccounts } from "../hooks/useAccounts";
import { fetchAnilist } from "../utils/anilist";
import { fetchDubRange } from "../utils/dubSchedule";
import { fetchHeroArtwork, isTitleTreatment } from "../utils/heroArtwork";
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
  (isTitleTreatment as jest.Mock).mockImplementation(
    (width: number, height: number) => width / height >= 1.5,
  );
  (fetchHeroArtwork as jest.Mock).mockResolvedValue([]);
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  localStorage.clear();
  (fetchAnilist as jest.Mock).mockResolvedValue({
    Page: { airingSchedules: [] },
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

test('a mislabeled square poster stays hidden and leaves a readable hero title', async () => {
  (fetchHeroArtwork as jest.Mock).mockResolvedValue(['https://artworks.thetvdb.com/bad-cover.png']);
  await act(async () => { root.render(<HomeDashboard slides={[anime]} rows={[]} history={[]} accounts={fakeAccounts()} onSelect={jest.fn()} onWatch={jest.fn()} onResume={jest.fn()} onRemove={jest.fn()} onCalendar={jest.fn()} />); });
  const image = node.querySelector('h1 img') as HTMLImageElement;
  expect(image.style.display).toBe('none');
  expect(node.querySelector('h1')?.textContent).toBe('Example anime');
  Object.defineProperties(image, { naturalWidth: { value: 1024 }, naturalHeight: { value: 1024 } });
  act(() => image.dispatchEvent(new Event('load')));
  expect(node.querySelector('h1 img')).toBeNull();
  expect(node.querySelector('h1')?.textContent).toBe('Example anime');
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
  const resume = jest.fn(),
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
        onSelect={jest.fn()}
        onWatch={jest.fn()}
        onResume={resume}
        onRemove={jest.fn()}
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
