import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { PlayerEpisodeCarousel } from "./PlayerEpisodeCarousel";

test("centers the playing episode and snaps to the next card without starting it", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const select = jest.fn();
  const close = jest.fn();
  const scroll = jest.fn();
  const width = jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);
  const left = jest.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return (Number(this.dataset.episode) - 1) * 200;
  });
  const viewport = jest.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(200);
  const previousScroll = HTMLElement.prototype.scrollTo;
  const previousMatch = window.matchMedia;
  HTMLElement.prototype.scrollTo = scroll;
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  try {
    act(() => root.render(<PlayerEpisodeCarousel episode={2} numbers={[1, 2, 3]} episodes={{}} onSelect={select} onClose={close} />));
    expect(scroll).toHaveBeenLastCalledWith({ left: 200, behavior: "auto" });
    expect(container.querySelector('[data-position="center"]')?.textContent).toContain("Episode 2");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Browse next episode"]')!.click());
    expect(scroll).toHaveBeenLastCalledWith({ left: 400, behavior: "smooth" });
    expect(select).not.toHaveBeenCalled();
    const strip = container.querySelector<HTMLElement>(".apex-carousel-strip")!;
    strip.scrollLeft = 400;
    act(() => strip.dispatchEvent(new Event("scroll")));
    act(() => container.querySelector<HTMLButtonElement>('[data-position="center"]')!.click());
    expect(select).toHaveBeenCalledWith(3);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Close episodes"]')!.click());
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    width.mockRestore();
    left.mockRestore();
    viewport.mockRestore();
    HTMLElement.prototype.scrollTo = previousScroll;
    window.matchMedia = previousMatch;
    container.remove();
  }
});
