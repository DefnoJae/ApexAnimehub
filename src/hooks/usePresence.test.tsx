import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { usePresence } from "./usePresence";

test("visible tabs announce presence and background tabs stop their heartbeat", async () => {
  jest.useFakeTimers();
  const originalFetch = global.fetch;
  const uuid = Object.getOwnPropertyDescriptor(window, "crypto");
  const visibility = Object.getOwnPropertyDescriptor(
    document,
    "visibilityState",
  );
  const beacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");
  const sendBeacon = jest.fn(() => true);
  const request = jest.fn(async () => ({
    ok: true,
    headers: { get: () => null },
    json: async () => ({ count: 7 }),
  }));
  global.fetch = request as unknown as typeof fetch;
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: { randomUUID: () => "f4177be4-1246-47a4-83ac-efcc7daa69fa" },
  });
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon,
  });
  const setVisibility = (value: "visible" | "hidden") =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value,
    });
  setVisibility("visible");
  const node = document.createElement("div");
  const root = createRoot(node);
  function Counter() {
    return <span>{usePresence()}</span>;
  }
  try {
    await act(async () => root.render(<Counter />));
    expect(node.textContent).toBe("7");
    expect(request).toHaveBeenCalledTimes(1);
    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(80000);
    });
    expect(node.textContent).toBe("");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(node.textContent).toBe("7");
  } finally {
    act(() => root.unmount());
    global.fetch = originalFetch;
    localStorage.removeItem("apex_presence_visitor_v1");
    for (const [target, key, descriptor] of [
      [window, "crypto", uuid],
      [document, "visibilityState", visibility],
      [navigator, "sendBeacon", beacon],
    ] as const) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
    jest.useRealTimers();
  }
});
