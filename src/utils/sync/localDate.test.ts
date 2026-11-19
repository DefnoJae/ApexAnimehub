import { localToday } from "./localDate";

test("localToday formats the local calendar day as zero-padded YYYY-MM-DD", () => {
  expect(localToday(new Date(2026, 0, 2, 23, 30))).toBe("2026-01-02");
  expect(localToday(new Date(2026, 10, 19, 0, 5))).toBe("2026-11-19");
});
