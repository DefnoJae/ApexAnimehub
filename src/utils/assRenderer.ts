export interface AssRenderer {
  resize(width: number, height: number): void;
  setCurrentTime(time: number): void;
  dispose(): void;
}
interface Options {
  canvas: HTMLCanvasElement;
  subContent: string;
  fonts: string[];
  workerUrl: string;
  fallbackFont: string;
  targetFps: number;
  libassMemoryLimit: number;
  libassGlyphLimit: number;
  onReady: () => void;
  onError: () => void;
}
declare global {
  interface Window {
    SubtitlesOctopus?: new (options: Options) => AssRenderer;
  }
}
let loading: Promise<void> | undefined;
export function loadAssRenderer() {
  if (window.SubtitlesOctopus) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/libass/subtitles-octopus.js";
      const timeout = window.setTimeout(() => {
        loading = undefined;
        script.remove();
        reject(new Error("Styled subtitles took too long to load."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timeout);
        if (window.SubtitlesOctopus) resolve();
        else {
          loading = undefined;
          reject(new Error("Styled subtitles unavailable."));
        }
      };
      script.onerror = () => {
        clearTimeout(timeout);
        loading = undefined;
        reject(new Error("Styled subtitles unavailable."));
      };
      document.head.appendChild(script);
    });
  return loading;
}
