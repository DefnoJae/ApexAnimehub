import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { usePlayerKeyboard } from "./usePlayerKeyboard";
test("player shortcuts own Space and arrows across toolbar, outside clicks and fullscreen, but not editor input", async () => {
  const commands = {
    toggle: jest.fn(),
    seek: jest.fn(),
    fullscreen: jest.fn(),
    next: jest.fn(),
    previous: jest.fn(),
    error: jest.fn(),
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Player() {
    const ref = useRef<HTMLDivElement>(null);
    usePlayerKeyboard(ref, commands);
    return (
      <>
        <div ref={ref} tabIndex={-1} aria-label="Player">
          <button>Fullscreen</button>
          <div className="signsync-panel">
            <button>Find subtitles</button>
            <input />
          </div>
        </div>
        <button>Outside player</button>
      </>
    );
  }
  const press = (target: Element, key: string, repeat = false) => {
    const event = new KeyboardEvent("keydown", {
      key,
      repeat,
      bubbles: true,
      cancelable: true,
    });
    act(() => target.dispatchEvent(event));
    return event;
  };
  try {
    await act(async () => root.render(<Player />));
    const player = host.querySelector('[aria-label="Player"]')!;
    expect(document.activeElement).toBe(player);
    const buttons = host.querySelectorAll("button");
    buttons[0].focus();
    expect(press(buttons[0], " ").defaultPrevented).toBe(true);
    expect(commands.toggle).toHaveBeenCalledTimes(1);
    buttons[2].focus();
    press(buttons[2], "ArrowRight");
    press(buttons[2], "ArrowLeft");
    expect(commands.seek.mock.calls).toEqual([[10], [-10]]);
    press(host.querySelector("input")!, "ArrowLeft");
    press(buttons[1], " ");
    expect(commands.seek).toHaveBeenCalledTimes(2);
    expect(commands.toggle).toHaveBeenCalledTimes(1);
    act(() => document.dispatchEvent(new Event("fullscreenchange")));
    expect(document.activeElement).toBe(player);
    press(player, " ");
    expect(commands.toggle).toHaveBeenCalledTimes(2);
    expect(press(buttons[0], " ", true).defaultPrevented).toBe(true);
    expect(commands.toggle).toHaveBeenCalledTimes(2);
    press(player, "ArrowRight", true);
    expect(commands.seek).toHaveBeenLastCalledWith(10);
    act(() => root.unmount());
    press(document.body, " ");
    expect(commands.toggle).toHaveBeenCalledTimes(2);
  } finally {
    host.remove();
  }
});
