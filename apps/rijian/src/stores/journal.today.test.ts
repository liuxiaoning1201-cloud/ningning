import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatLongDate, setNowForTests } from "../lib/dates";
import { startTodayClock } from "../lib/todayClock";
import { CATEGORIES, type JournalState } from "../types";
import { resetJournalRuntimeForTests, STORAGE_KEY, useJournal } from "./journal";

function lists() {
  return CATEGORIES.map(({ id, name, sort }) => ({ id, name, sort }));
}

function historicalFixture(): JournalState {
  return {
    items: [
      {
        id: "task-keep",
        type: "task",
        title: "舊待辦不要改期",
        body: "內容應原封不動",
        status: "open",
        important: false,
        mark: null,
        dueOn: "2026-11-01",
        listId: null,
        parentId: null,
        tagColor: null,
        collapsed: false,
        loggedOn: null,
        rank: 10,
        todayRank: 10,
        createdAt: 1,
        updatedAt: 2,
        deletedAt: null,
      },
      {
        id: "log-keep",
        type: "log",
        title: "11月8日的紀錄",
        body: "當日日誌正文",
        status: "done",
        important: false,
        mark: "ask",
        dueOn: null,
        listId: null,
        parentId: null,
        tagColor: null,
        collapsed: false,
        loggedOn: "2026-11-08",
        rank: 11,
        todayRank: 11,
        createdAt: 3,
        updatedAt: 4,
        deletedAt: null,
      },
    ],
    lists: lists(),
    reminders: [
      {
        id: "rem-keep",
        itemId: "task-keep",
        fireOn: "2026-12-01",
        kind: "minus_1d",
        firedAt: null,
      },
    ],
    notes: {
      inbox: "<p>收件匣原文</p>",
      "2026-11-08": "<p>昨天的日記，禁止改期</p>",
      "2026-10-31": "<p>萬聖節隨記</p>",
    },
    notebooks: [{ id: "nb-keep", name: "隨想", html: "<p>筆記本原文勿刪</p>", createdAt: 5 }],
    activeNotebookId: "nb-keep",
  };
}

function snapshotData(state: JournalState) {
  return JSON.parse(JSON.stringify(state)) as JournalState;
}

function loadStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return useJournal();
}

beforeEach(() => {
  resetJournalRuntimeForTests();
  setNowForTests(new Date("2026-11-08T21:00:00+08:00"));
  globalThis.localStorage.removeItem(STORAGE_KEY);
});

afterEach(() => {
  setNowForTests(null);
  resetJournalRuntimeForTests();
  globalThis.localStorage.removeItem(STORAGE_KEY);
});

describe("journal today refresh preserves stored entries", () => {
  it("keeps historical records byte-stable across 2026-11-09 rollover", () => {
    const fixture = historicalFixture();
    const raw = JSON.stringify(fixture);
    globalThis.localStorage.setItem(STORAGE_KEY, raw);

    const journal = loadStore();
    expect(journal.today).toBe("2026-11-08");
    const afterLoad = snapshotData(journal.data);
    expect(afterLoad.notes["2026-11-08"]).toBe("<p>昨天的日記，禁止改期</p>");
    expect(afterLoad.notes["2026-10-31"]).toBe("<p>萬聖節隨記</p>");
    expect(afterLoad.notes.inbox).toBe("<p>收件匣原文</p>");
    expect(afterLoad.notebooks[0]).toEqual(fixture.notebooks[0]);
    expect(afterLoad.items.map((i) => i.id)).toEqual(["task-keep", "log-keep"]);

    journal.composerDraft = "未送出的草稿";
    journal.selectedId = "task-keep";
    journal.view = "inbox";

    setNowForTests(new Date("2026-11-09T10:18:00+08:00"));
    journal.refreshToday();

    expect(journal.today).toBe("2026-11-09");
    expect(formatLongDate(journal.today)).toBe("2026年11月9日　星期一");
    expect(journal.composerDraft).toBe("未送出的草稿");
    expect(journal.selectedId).toBe("task-keep");
    expect(journal.view).toBe("inbox");
    expect(snapshotData(journal.data)).toEqual(afterLoad);
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe(raw);

    journal.setTodayNote("<p>11月9日新頁</p>");
    expect(journal.data.notes["2026-11-08"]).toBe("<p>昨天的日記，禁止改期</p>");
    expect(journal.data.notes["2026-10-31"]).toBe("<p>萬聖節隨記</p>");
    expect(journal.data.notes["2026-11-09"]).toBe("<p>11月9日新頁</p>");
    expect(journal.data.items.find((i) => i.id === "task-keep")?.dueOn).toBe("2026-11-01");
    expect(journal.data.items.find((i) => i.id === "log-keep")?.loggedOn).toBe("2026-11-08");
  });

  it("updates today on refocus without rewriting stored entries", () => {
    const fixture = historicalFixture();
    const raw = JSON.stringify(fixture);
    globalThis.localStorage.setItem(STORAGE_KEY, raw);
    const journal = loadStore();
    const afterLoad = snapshotData(journal.data);

    const listeners = new Map<string, Set<() => void>>();
    const win = {
      addEventListener(type: string, listener: () => void) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners.get(type)?.delete(listener);
      },
    };
    const clock = startTodayClock(() => journal.refreshToday(), {
      window: win,
      document: {
        visibilityState: "visible",
        addEventListener() {},
        removeEventListener() {},
      },
    });

    setNowForTests(new Date("2026-11-09T10:18:00+08:00"));
    listeners.get("focus")?.forEach((fn) => fn());

    expect(journal.today).toBe("2026-11-09");
    expect(snapshotData(journal.data)).toEqual(afterLoad);
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe(raw);
    clock.stop();
  });

  it("does not re-date historical notes when writing the new today page", () => {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(historicalFixture()));
    const journal = loadStore();
    setNowForTests(new Date("2026-11-09T00:00:00+08:00"));
    journal.refreshToday();
    journal.setTodayNote("<p>新的一天</p>");
    journal.addLog("今天的一句");

    const log = journal.data.items.find((i) => i.title === "今天的一句");
    expect(log?.loggedOn).toBe("2026-11-09");
    expect(journal.data.items.find((i) => i.id === "log-keep")?.loggedOn).toBe("2026-11-08");
    expect(journal.data.notes["2026-11-08"]).toBe("<p>昨天的日記，禁止改期</p>");
    expect(Object.keys(journal.data.notes).sort()).toEqual(
      ["2026-10-31", "2026-11-08", "2026-11-09", "inbox"].sort(),
    );
  });
});
