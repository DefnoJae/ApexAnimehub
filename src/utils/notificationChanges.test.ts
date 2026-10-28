import { entryChanges } from "./notificationChanges";
test("rating edits include old and new scores, new ratings and clearing", () => {
  const before = { status: "watching" as const, progress: 4, score: 7 };
  expect(entryChanges(before, { ...before, score: 9 })).toEqual([
    "Rating updated: 7 → 9",
  ]);
  expect(
    entryChanges({ ...before, score: 0 }, { ...before, score: 9 }),
  ).toEqual(["Rating added: 9/10"]);
  expect(entryChanges(before, { ...before, score: 0 })).toEqual([
    "Rating removed: 7 → Unrated",
  ]);
  expect(entryChanges(before, before)).toEqual([]);
});
test("entry status and progress notifications describe actual changes", () => {
  expect(entryChanges(undefined, { status: "planning", progress: 0 })).toEqual([
    "Added to Planning",
  ]);
  expect(
    entryChanges(
      { status: "watching", progress: 11 },
      { status: "completed", progress: 12 },
    ),
  ).toEqual([
    "Status updated: Watching → Completed",
    "Episodes watched: 11 → 12",
  ]);
});
