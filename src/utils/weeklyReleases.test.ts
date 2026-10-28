import { currentReleaseWeek, orderWeeklyReleases } from "./weeklyReleases";
test("week boundaries use local Monday through Sunday, including year rollover", () => {
  const { start, end } = currentReleaseWeek(new Date(2027, 0, 3, 12));
  expect(start.getDay()).toBe(1);
  expect(start.getDate()).toBe(28);
  expect(start.getFullYear()).toBe(2026);
  expect(end.getDate()).toBe(4);
  expect(end.getHours()).toBe(0);
});
test("today's newest releases lead, followed by today's schedule, older releases and upcoming days", () => {
  const now = new Date(2026, 9, 28, 15);
  const item = (id: number, day: number, hour: number) => ({
    id,
    releaseAt: +new Date(2026, 9, day, hour),
  });
  const data = [
    item(1, 27, 12),
    item(2, 28, 10),
    item(3, 28, 14),
    item(4, 28, 19),
    item(5, 29, 10),
    item(6, 25, 20),
    item(7, 2, 10),
  ];
  expect(orderWeeklyReleases(data, now).map((item) => item.id)).toEqual([
    3, 2, 4, 1, 5,
  ]);
  expect(
    orderWeeklyReleases(data, new Date(2026, 9, 28, 20)).map((item) => item.id),
  ).toEqual([4, 3, 2, 1, 5]);
});
