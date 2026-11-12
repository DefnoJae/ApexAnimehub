import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { StyledSigns } from "./StyledSigns";

test("styled signs retain ASS, follow seeks and delay, and dispose on removal", async () => {
  jest.useFakeTimers();
  const setCurrentTime = jest.fn();
  const dispose = jest.fn();
  let ready: () => void = () => {};
  const renderer = jest.fn().mockImplementation((options) => {
    ready = options.onReady;
    return { setCurrentTime, dispose, resize: jest.fn() };
  });
  window.SubtitlesOctopus = renderer;
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const fonts: string[] = [];
  let time = 209;
  function Player({ delay = 0 }) {
    const host = useRef<HTMLDivElement>(null);
    return (
      <div ref={host}>
        <video style={{ objectFit: "contain" }} />
        <StyledSigns
          ass="[Events]\nDialogue: styled"
          fonts={fonts}
          root={host}
          position={() => time}
          delay={delay}
          onFailure={jest.fn()}
        />
      </div>
    );
  }
  try {
    await act(async () => root.render(<Player />));
    expect(renderer.mock.calls[0][0].subContent).toContain("Dialogue: styled");
    act(() => {
      ready();
      jest.advanceTimersByTime(34);
    });
    expect(setCurrentTime).toHaveBeenLastCalledWith(209);
    const video = node.querySelector("video")!;
    const canvas = node.querySelector("canvas")!;
    Object.defineProperties(video, {
      videoWidth: { value: 1440 },
      videoHeight: { value: 1080 },
    });
    jest.spyOn(video, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 1600, height: 900,
    } as DOMRect);
    act(() => video.dispatchEvent(new Event("loadedmetadata")));
    expect(canvas.style.left).toBe("200px");
    expect(canvas.style.width).toBe("1200px");
    video.style.objectFit = "cover";
    act(() => video.dispatchEvent(new Event("resize")));
    expect(canvas.style.top).toBe("-150px");
    expect(canvas.style.height).toBe("1200px");
    time = 100;
    act(() => jest.advanceTimersByTime(34));
    expect(setCurrentTime).toHaveBeenLastCalledWith(100);
    await act(async () => root.render(<Player delay={2} />));
    act(() => jest.advanceTimersByTime(34));
    expect(setCurrentTime).toHaveBeenLastCalledWith(98);
    expect(renderer).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(dispose).toHaveBeenCalledTimes(1);
    const calls = setCurrentTime.mock.calls.length;
    act(() => jest.advanceTimersByTime(100));
    expect(setCurrentTime).toHaveBeenCalledTimes(calls);
  } finally {
    delete window.SubtitlesOctopus;
    node.remove();
    jest.useRealTimers();
  }
});
