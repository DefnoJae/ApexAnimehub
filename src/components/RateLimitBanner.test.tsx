import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { RateLimitBanner } from "./RateLimitBanner";
import { setRateLimitRetryAt } from "../utils/rateLimitClock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  setRateLimitRetryAt(0);
  jest.useRealTimers();
});

test("counts down live from the shared AniList retry time", () => {
  jest.useFakeTimers();
  setRateLimitRetryAt(Date.now() + 25_000);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<RateLimitBanner />));
    expect(host.textContent).toContain("retrying in 25s");
    act(() => jest.advanceTimersByTime(3_000));
    expect(host.textContent).toContain("retrying in 22s");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

test("renders nothing when AniList is not rate limited", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<RateLimitBanner />));
    expect(host.textContent).toBe("");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
