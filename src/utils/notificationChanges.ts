import type { ListStatus } from "../hooks/useAccounts";
interface Entry {
  status: ListStatus;
  progress: number;
  score?: number;
}
const labels: Record<ListStatus, string> = {
  planning: "Planning",
  watching: "Watching",
  completed: "Completed",
  paused: "Paused",
  dropped: "Dropped",
};
export function entryChanges(
  before: Entry | undefined,
  after: Entry,
): string[] {
  const changes: string[] = [];
  if (!before) changes.push("Added to " + labels[after.status]);
  else if (before.status !== after.status)
    changes.push(
      "Status updated: " + labels[before.status] + " → " + labels[after.status],
    );
  if ((before?.progress || 0) !== after.progress)
    changes.push(
      "Episodes watched: " + (before?.progress || 0) + " → " + after.progress,
    );
  const oldScore = before?.score || 0,
    score = after.score || 0;
  if (oldScore !== score)
    changes.push(
      score === 0
        ? "Rating removed: " + oldScore + " → Unrated"
        : oldScore === 0
          ? "Rating added: " + score + "/10"
          : "Rating updated: " + oldScore + " → " + score,
    );
  return changes;
}
