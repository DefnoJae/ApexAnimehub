import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { DetailTitle } from "./DetailTitle";
import { fetchHeroArtwork } from "../utils/heroArtwork";
jest.mock("../utils/heroArtwork", () => ({
  ...jest.requireActual("../utils/heroArtwork"),
  fetchHeroArtwork: jest.fn(),
}));
test("never flashes standard text while loading and accepts a square TMDB logo", async () => {
  const node = document.createElement("div"),
    root = createRoot(node);
  let resolve: (urls: string[]) => void = () => {};
  (fetchHeroArtwork as jest.Mock).mockReturnValue(
    new Promise<string[]>((done) => {
      resolve = done;
    }),
  );
  try {
    act(() => root.render(<DetailTitle id={1} title="18if" />));
    expect(node.textContent).toBe("");
    expect(node.querySelector(".detail-title-placeholder")).not.toBeNull();
    await act(async () =>
      resolve(["https://image.tmdb.org/t/p/original/18if.png"]),
    );
    expect(node.textContent).toBe("");
    const image = node.querySelector("img")!;
    Object.defineProperties(image, {
      naturalWidth: { value: 500 },
      naturalHeight: { value: 500 },
    });
    act(() => image.dispatchEvent(new Event("load")));
    expect(image.style.display).toBe("block");
    expect(node.textContent).toBe("");
    expect(node.querySelector(".detail-title-placeholder")).toBeNull();
  } finally {
    act(() => root.unmount());
  }
});
test("text is only used after no usable logo exists", async () => {
  const node = document.createElement("div"),
    root = createRoot(node);
  (fetchHeroArtwork as jest.Mock).mockResolvedValue([
    "https://image.tmdb.org/t/p/original/broken.png",
  ]);
  try {
    await act(async () =>
      root.render(<DetailTitle id={2} title="Fallback title" />),
    );
    expect(node.textContent).toBe("");
    act(() => node.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(node.textContent).toBe("Fallback title");
  } finally {
    act(() => root.unmount());
  }
});
