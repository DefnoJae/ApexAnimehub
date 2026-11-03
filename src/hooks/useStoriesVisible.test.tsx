import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useStoriesVisible } from "./useStoriesVisible";
test("story visibility updates across consumers and persists after remount", () => {
  localStorage.clear();
  const host = document.createElement("div");
  const root = createRoot(host);
  function Harness() {
    const [visible, setVisible] = useStoriesVisible();
    return (
      <button onClick={() => setVisible(!visible)}>{String(visible)}</button>
    );
  }
  act(() =>
    root.render(
      <>
        <Harness />
        <Harness />
      </>,
    ),
  );
  expect(host.textContent).toBe("truetrue");
  act(() => host.querySelector("button")!.click());
  expect(host.textContent).toBe("falsefalse");
  act(() => root.render(<Harness key="new" />));
  expect(host.textContent).toBe("false");
  act(() => root.unmount());
  localStorage.clear();
});
