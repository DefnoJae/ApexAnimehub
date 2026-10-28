import {
  resumeSeconds,
  saveEpisodeProgress,
  readEpisodeProgress,
} from "./playbackResume";
test("resume positions are episode-specific and completed or corrupt entries do not resume", () => {
  localStorage.clear();
  saveEpisodeProgress(1, 2, 14, 1440);
  expect(resumeSeconds(readEpisodeProgress(1, 2))).toBe(14);
  expect(resumeSeconds(readEpisodeProgress(1, 3))).toBe(0);
  expect(resumeSeconds({ position: 1438, duration: 1440 })).toBe(0);
  expect(resumeSeconds({ position: Infinity, duration: 1440 })).toBe(0);
  expect(resumeSeconds({ position: -1, duration: 1440 })).toBe(0);
  localStorage.clear();
});
