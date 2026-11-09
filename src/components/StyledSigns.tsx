import React, { RefObject, useEffect, useRef } from "react";
import { AssRenderer, loadAssRenderer } from "../utils/assRenderer";
export function StyledSigns({
  ass,
  fonts,
  root,
  position,
  delay,
  onFailure,
}: {
  ass: string;
  fonts: string[];
  root: RefObject<HTMLDivElement>;
  position: () => number;
  delay: number;
  onFailure: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ position, delay, onFailure });
  clock.current = { position, delay, onFailure };
  useEffect(() => {
    let active = true;
    let renderer: AssRenderer | undefined;
    let ready = false;
    const element = canvas.current;
    const host = root.current;
    if (!element || !host) return;
    const resize = () => {
      const video = host.querySelector("video");
      const stage = host.querySelector(".anipm-player-stage") || video || host;
      const box = stage.getBoundingClientRect();
      const bounds = host.getBoundingClientRect();
      const ratio =
        video?.videoWidth && video.videoHeight
          ? video.videoWidth / video.videoHeight
          : 16 / 9;
      const width = Math.min(box.width, box.height * ratio);
      const height = width / ratio;
      element.style.left =
        box.left - bounds.left + (box.width - width) / 2 + "px";
      element.style.top =
        box.top - bounds.top + (box.height - height) / 2 + "px";
      element.style.width = width + "px";
      element.style.height = height + "px";
      if (ready && width > 0 && height > 0)
        renderer?.resize(Math.round(width), Math.round(height));
    };
    void loadAssRenderer()
      .then(() => {
        if (!active || !window.SubtitlesOctopus) return;
        renderer = new window.SubtitlesOctopus({
          canvas: element,
          subContent: ass,
          fonts,
          workerUrl: "/vendor/libass/subtitles-octopus-worker.js",
          fallbackFont: "/vendor/libass/default.woff2",
          targetFps: 30,
          libassMemoryLimit: 32,
          libassGlyphLimit: 8,
          onReady: () => {
            ready = true;
            resize();
          },
          onError: () => {
            if (active) clock.current.onFailure();
          },
        });
      })
      .catch(() => {
        if (active) clock.current.onFailure();
      });
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : undefined;
    observer?.observe(host);
    window.addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", resize);
    const timer = window.setInterval(() => {
      if (ready)
        renderer?.setCurrentTime(
          Math.max(0, clock.current.position() - clock.current.delay),
        );
    }, 33);
    resize();
    return () => {
      active = false;
      clearInterval(timer);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("fullscreenchange", resize);
      renderer?.dispose();
    };
  }, [ass, fonts, root]);
  return (
    <canvas
      ref={canvas}
      className="signsync-ass-canvas"
      aria-label="SignSync styled subtitles"
    />
  );
}
