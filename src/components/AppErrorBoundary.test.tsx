import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AppErrorBoundary } from "./AppErrorBoundary";
test("an unexpected render error shows recovery and retries without deleting saved data", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  localStorage.setItem("videasy_history", "saved progress");
  let broken = true;
  function Page() {
    if (broken) throw new Error("Render failed");
    return <h1>Home</h1>;
  }
  try {
    act(() =>
      root.render(
        <AppErrorBoundary>
          <Page />
        </AppErrorBoundary>,
      ),
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "This page couldn’t load",
    );
    expect(localStorage.getItem("videasy_history")).toBe("saved progress");
    broken = false;
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.textContent).toBe("Home");
  } finally {
    act(() => root.unmount());
    host.remove();
    log.mockRestore();
    localStorage.removeItem("videasy_history");
  }
});
