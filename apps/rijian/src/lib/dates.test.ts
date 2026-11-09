import { computed } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  msUntilNextLocalMidnight,
  setNowForTests,
  todayStr,
} from "./dates";

afterEach(() => {
  setNowForTests(null);
});

describe("local calendar dates (test TZ = Asia/Hong_Kong)", () => {
  it("runs tests in Asia/Hong_Kong (UTC+8)", () => {
    expect(new Date("2026-11-09T00:00:00").getTimezoneOffset()).toBe(-480);
  });

  it("treats 2026-11-09 10:18 in Hong Kong as 11月9日", () => {
    const now = new Date("2026-11-09T10:18:00+08:00");
    setNowForTests(now);
    expect(todayStr()).toBe("2026-11-09");
    expect(formatLongDate(todayStr())).toBe("2026年11月9日　星期一");
    expect(formatShortDate(todayStr())).toBe("11月9日");
  });

  it("does not use the UTC ISO date at the Hong Kong midnight boundary", () => {
    // 2026-11-09 00:30 HKT = 2026-11-08 16:30 UTC
    const instant = new Date("2026-11-08T16:30:00.000Z");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-11-08");
    expect(todayStr(instant)).toBe("2026-11-09");
    expect(formatLongDate(todayStr(instant))).toBe("2026年11月9日　星期一");
  });

  it("rolls the calendar day from 11月8日 to 11月9日", () => {
    setNowForTests(new Date("2026-11-08T23:59:59+08:00"));
    expect(todayStr()).toBe("2026-11-08");
    setNowForTests(new Date("2026-11-09T00:00:00+08:00"));
    expect(todayStr()).toBe("2026-11-09");
  });

  it("rolls the month from 11月30日 to 12月1日", () => {
    setNowForTests(new Date("2026-11-30T23:59:59+08:00"));
    expect(todayStr()).toBe("2026-11-30");
    setNowForTests(new Date("2026-12-01T00:00:01+08:00"));
    expect(todayStr()).toBe("2026-12-01");
    expect(formatLongDate("2026-12-01")).toBe("2026年12月1日　星期二");
  });

  it("rolls the year from 2026-12-31 to 2027-01-01", () => {
    setNowForTests(new Date("2026-12-31T23:59:59+08:00"));
    expect(todayStr()).toBe("2026-12-31");
    setNowForTests(new Date("2027-01-01T00:00:00+08:00"));
    expect(todayStr()).toBe("2027-01-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("schedules the next local midnight without crossing early", () => {
    const before = new Date("2026-11-08T23:59:30+08:00");
    const wait = msUntilNextLocalMidnight(before);
    expect(wait).toBe(30_000);
    expect(todayStr(new Date(before.getTime() + wait))).toBe("2026-11-09");
  });

  it("documents why a Vue computed around todayStr() freezes", () => {
    setNowForTests(new Date("2026-11-08T22:00:00+08:00"));
    const frozen = computed(() => todayStr());
    expect(frozen.value).toBe("2026-11-08");
    setNowForTests(new Date("2026-11-09T10:18:00+08:00"));
    expect(frozen.value).toBe("2026-11-08");
    expect(todayStr()).toBe("2026-11-09");
  });
});
