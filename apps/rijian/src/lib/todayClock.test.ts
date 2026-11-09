import { afterEach, describe, expect, it, vi } from "vitest";
import { msUntilNextLocalMidnight, setNowForTests, todayStr } from "./dates";
import { startTodayClock, type ClockDocument, type ClockWindow } from "./todayClock";

type Host = (ClockDocument & ClockWindow) & {
  visibilityState: string;
  dispatch(type: string): void;
};

function createHost(visibilityState = "visible"): Host {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      listeners.get(type)?.forEach((fn) => fn());
    },
  };
}

afterEach(() => {
  setNowForTests(null);
  vi.useRealTimers();
});

describe("todayClock", () => {
  it("refreshes when the page becomes visible again after 2026-11-09", () => {
    setNowForTests(new Date("2026-11-08T22:00:00+08:00"));
    const doc = createHost("hidden");
    const win = createHost();
    const seen: string[] = [];
    const clock = startTodayClock((today) => seen.push(today), { document: doc, window: win });

    setNowForTests(new Date("2026-11-09T10:18:00+08:00"));
    doc.dispatch("visibilitychange");
    expect(seen).toEqual([]);

    doc.visibilityState = "visible";
    doc.dispatch("visibilitychange");
    expect(seen).toEqual(["2026-11-09"]);
    expect(todayStr()).toBe("2026-11-09");
    clock.stop();
  });

  it("refreshes on window focus (reopen / refocus)", () => {
    setNowForTests(new Date("2026-11-08T21:00:00+08:00"));
    const win = createHost();
    const seen: string[] = [];
    const clock = startTodayClock((today) => seen.push(today), {
      document: createHost(),
      window: win,
    });

    setNowForTests(new Date("2026-11-09T08:00:00+08:00"));
    win.dispatch("focus");
    expect(seen).toEqual(["2026-11-09"]);
    clock.stop();
  });

  it("refreshes on pageshow (resume from sleep / bfcache)", () => {
    setNowForTests(new Date("2026-11-08T23:00:00+08:00"));
    const win = createHost();
    const seen: string[] = [];
    const clock = startTodayClock((today) => seen.push(today), {
      document: createHost(),
      window: win,
    });

    setNowForTests(new Date("2026-11-09T07:00:00+08:00"));
    win.dispatch("pageshow");
    expect(seen).toEqual(["2026-11-09"]);
    clock.stop();
  });

  it("rolls over at local midnight while the page stays open", () => {
    vi.useFakeTimers();
    const before = new Date("2026-11-08T23:59:30+08:00");
    setNowForTests(before);
    const seen: string[] = [];
    const clock = startTodayClock((today) => seen.push(today), {
      document: createHost(),
      window: createHost(),
    });

    setNowForTests(new Date("2026-11-09T00:00:00.050+08:00"));
    vi.advanceTimersByTime(msUntilNextLocalMidnight(before));
    expect(seen).toEqual(["2026-11-09"]);
    clock.stop();
  });

  it("rolls month and year at midnight", () => {
    vi.useFakeTimers();
    const before = new Date("2026-12-31T23:59:00+08:00");
    setNowForTests(before);
    const seen: string[] = [];
    const clock = startTodayClock((today) => seen.push(today), {
      document: createHost(),
      window: createHost(),
    });

    setNowForTests(new Date("2027-01-01T00:00:00+08:00"));
    vi.advanceTimersByTime(msUntilNextLocalMidnight(before));
    expect(seen).toEqual(["2027-01-01"]);
    clock.stop();
  });

  it("does not read or write storage while refreshing", () => {
    const key = "rijian.v1";
    globalThis.localStorage?.setItem(key, '{"guard":true}');
    setNowForTests(new Date("2026-11-08T12:00:00+08:00"));
    const win = createHost();
    const clock = startTodayClock(() => undefined, { document: createHost(), window: win });
    setNowForTests(new Date("2026-11-09T10:18:00+08:00"));
    win.dispatch("focus");
    expect(globalThis.localStorage?.getItem(key)).toBe('{"guard":true}');
    clock.stop();
    globalThis.localStorage?.removeItem(key);
  });
});
