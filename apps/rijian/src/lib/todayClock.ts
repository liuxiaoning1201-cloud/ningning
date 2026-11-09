import { msUntilNextLocalMidnight, todayStr } from "./dates";

const MAX_TIMEOUT = 2_147_483_647;

export type ClockDocument = {
  visibilityState?: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type ClockWindow = {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type TodayClockOptions = {
  document?: ClockDocument | null;
  window?: ClockWindow | null;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};

export type TodayClock = {
  refresh: () => string;
  stop: () => void;
};

/**
 * Keeps "today" current while the page/webview stays alive
 * (Tauri hides on close; midnight, focus, and resume must refresh).
 * Does not read or write journal storage.
 */
export function startTodayClock(
  onChange: (today: string) => void,
  options: TodayClockOptions = {},
): TodayClock {
  const doc =
    options.document === undefined
      ? typeof document !== "undefined"
        ? document
        : null
      : options.document;
  const win =
    options.window === undefined
      ? typeof window !== "undefined"
        ? window
        : null
      : options.window;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;

  let last = todayStr();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function refresh(): string {
    const next = todayStr();
    if (next !== last) {
      last = next;
      onChange(next);
    }
    return next;
  }

  function schedule(): void {
    if (stopped) return;
    if (timer != null) clearTimeoutFn(timer);
    const delay = Math.min(Math.max(msUntilNextLocalMidnight(), 1), MAX_TIMEOUT);
    timer = setTimeoutFn(() => {
      timer = null;
      refresh();
      schedule();
    }, delay);
  }

  function onResume(): void {
    refresh();
    schedule();
  }

  function onVisibility(): void {
    if (doc?.visibilityState === "hidden") return;
    onResume();
  }

  doc?.addEventListener("visibilitychange", onVisibility);
  win?.addEventListener("focus", onResume);
  win?.addEventListener("pageshow", onResume);

  schedule();

  return {
    refresh,
    stop() {
      stopped = true;
      if (timer != null) {
        clearTimeoutFn(timer);
        timer = null;
      }
      doc?.removeEventListener("visibilitychange", onVisibility);
      win?.removeEventListener("focus", onResume);
      win?.removeEventListener("pageshow", onResume);
    },
  };
}
