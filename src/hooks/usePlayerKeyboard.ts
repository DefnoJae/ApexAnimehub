import { RefObject, useEffect, useRef } from "react";
interface Controls {
  toggle: () => unknown;
  seek: (seconds: number) => unknown;
  fullscreen: () => unknown;
  next: () => unknown;
  previous: () => unknown;
  error: (reason: unknown) => void;
}
// Parent-frame shortcuts must run before Space activates the focused toolbar
// button. Keys inside a cross-origin video frame remain with its native player.
export function usePlayerKeyboard(
  root: RefObject<HTMLDivElement>,
  controls: Controls,
) {
  const current = useRef(controls);
  current.current = controls;
  useEffect(() => {
    let active = true;
    const focus = () => root.current?.focus({ preventScroll: true });
    focus();
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],.signsync-panel,.anipm-resume-prompt',
        )
      )
        return;
      const key = event.key.toLowerCase();
      let action: (() => unknown) | undefined;
      if (key === "arrowleft") action = () => current.current.seek(-10);
      else if (key === "arrowright") action = () => current.current.seek(10);
      else if (!event.repeat) {
        if (key === " " || key === "spacebar")
          action = () => current.current.toggle();
        if (key === "f") action = () => current.current.fullscreen();
        if (key === "n") action = () => current.current.next();
        if (key === "b") action = () => current.current.previous();
      }
      // Suppress repeated Space/F too, so they cannot click a focused button.
      if (
        !action &&
        !(event.repeat && [" ", "spacebar", "f", "n", "b"].includes(key))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action)
        try {
          void Promise.resolve(action()).catch((reason) => {
            if (active) current.current.error(reason);
          });
        } catch (reason) {
          if (active) current.current.error(reason);
        }
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("fullscreenchange", focus);
    return () => {
      active = false;
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("fullscreenchange", focus);
    };
  }, [root]);
}
