export function currentReleaseWeek(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}
export function orderWeeklyReleases<T extends { releaseAt?: number }>(
  items: T[],
  now = new Date(),
): T[] {
  const { start, end } = currentReleaseWeek(now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const group = (time: number) =>
    time >= +today && time < +tomorrow
      ? time <= +now
        ? 0
        : 1
      : time <= +now
        ? 2
        : 3;
  return items
    .filter(
      (item) =>
        Number.isFinite(item.releaseAt) &&
        item.releaseAt! >= +start &&
        item.releaseAt! < +end,
    )
    .sort(
      (a, b) =>
        group(a.releaseAt!) - group(b.releaseAt!) ||
        (group(a.releaseAt!) === 0 || group(a.releaseAt!) === 2
          ? b.releaseAt! - a.releaseAt!
          : a.releaseAt! - b.releaseAt!),
    );
}
