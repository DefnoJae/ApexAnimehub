import React from "react";
import { Flag } from "lucide-react";
import type { CalendarRelease } from "../utils/animeSchedule";
export function isScheduleFinale(release: CalendarRelease) {
  const total = release.anime.episodes;
  return (
    typeof total === "number" &&
    Number.isInteger(total) &&
    total > 0 &&
    release.episode === total
  );
}
export function ScheduleFinale({
  release,
  compact = false,
}: {
  release: CalendarRelease;
  compact?: boolean;
}) {
  return isScheduleFinale(release) ? (
    <span
      className={"calendar-finale" + (compact ? " is-compact" : "")}
      aria-label="Finale"
      title="Final episode"
    >
      <Flag size={compact ? 12 : 13} aria-hidden="true" />
      {!compact && "Finale"}
    </span>
  ) : null;
}
