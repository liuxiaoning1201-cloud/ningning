import { invoke } from "@tauri-apps/api/core";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { todayStr } from "../lib/dates";
import { now, uid } from "../lib/id";
import { parseCapture } from "../lib/parse";
import { remindersForItem } from "../lib/reminders";
import { isCaptureMode, isTauri } from "../lib/tauri";
import type { Item, ItemMark, JournalState, List, Notebook, Reminder, ViewId } from "../types";
import { CATEGORIES, categoryColor, isProject } from "../types";

const STORAGE_KEY = "rijian.v1";
const INBOX_NOTE_KEY = "inbox";

let persistEnabled = true;
let diskTimer: ReturnType<typeof setTimeout> | null = null;

function seedLists(): List[] {
  return CATEGORIES.map(({ id, name, sort }) => ({ id, name, sort }));
}

function mapListId(id: string | null, name?: string): string {
  if (id === "work" || name === "工作") return "work";
  if (id === "study" || name === "學習") return "study";
  if (id === "life" || name === "生活" || id === "home" || name === "家事") return "life";
  if (id === "play" || name === "娛樂") return "play";
  if (id === "other" || name === "其他") return "other";
  if (id && CATEGORIES.some((c) => c.id === id)) return id;
  return "other";
}

function seed(): JournalState {
  return {
    items: [],
    lists: seedLists(),
    reminders: [],
    notes: {},
    notebooks: [],
    activeNotebookId: null,
  };
}

function migrate(parsed: Partial<JournalState> & { items: Item[] }): JournalState {
  const today = todayStr();
  const listName = new Map((parsed.lists ?? []).map((l) => [l.id, l.name]));
  const reminders = (parsed.reminders ?? []).map((r) =>
    !r.firedAt && r.fireOn <= today ? { ...r, firedAt: Date.now() } : r,
  );
  const items = parsed.items.map((item) => {
    const parentId = item.parentId ?? null;
    let listId = item.listId ? mapListId(item.listId, listName.get(item.listId)) : item.listId ?? null;
    const orphanTask = item.type === "task" && !parentId && !listId;
    if (orphanTask && !item.dueOn) {
      listId = "other";
    } else if (orphanTask && item.status === "open" && item.dueOn && item.dueOn > today) {
      listId = "other";
    }
    const project = item.type === "task" && !parentId && Boolean(listId);
    const stamp = item.createdAt ?? 0;
    return {
      ...item,
      mark: item.mark ?? null,
      parentId,
      listId,
      tagColor: item.tagColor ?? (project ? categoryColor(listId) : null),
      collapsed: item.collapsed ?? false,
      rank: item.rank ?? stamp,
      todayRank: item.todayRank ?? item.rank ?? stamp,
    };
  });
  const notes = migrateNotes(parsed.notes ?? {});
  const notebooks = migrateNotebooks(parsed.notebooks ?? [], notes);
  const activeNotebookId = notebooks.some((n) => n.id === parsed.activeNotebookId)
    ? (parsed.activeNotebookId ?? notebooks[0]?.id ?? null)
    : (notebooks[0]?.id ?? null);
  return {
    items,
    lists: seedLists(),
    reminders,
    notes,
    notebooks,
    activeNotebookId,
  };
}

function notePlain(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function migrateNotes(notes: Record<string, string>): Record<string, string> {
  const next = { ...notes };
  if (next[INBOX_NOTE_KEY] != null) return next;
  const dated = Object.entries(notes)
    .filter(([key, html]) => key !== INBOX_NOTE_KEY && notePlain(html ?? ""))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, html]) => `<p class="note-day">${key}</p>${html}`);
  next[INBOX_NOTE_KEY] = dated.join("");
  return next;
}

// 把舊的單張隨想紙面搬進第一本筆記本，確保升級不丟任何文字。
function migrateNotebooks(notebooks: Notebook[], notes: Record<string, string>): Notebook[] {
  const list = notebooks
    .filter((n) => n && typeof n.id === "string")
    .map((n) => ({
      id: n.id,
      name: (n.name ?? "").trim() || "隨想",
      html: n.html ?? "",
      createdAt: n.createdAt ?? 0,
    }));
  if (list.length > 0) return list;
  return [
    {
      id: uid(),
      name: "隨想",
      html: notes[INBOX_NOTE_KEY] ?? "",
      createdAt: now(),
    },
  ];
}

function byRank(a: Item, b: Item, field: "rank" | "todayRank") {
  return (a[field] ?? a.createdAt) - (b[field] ?? b.createdAt) || a.createdAt - b.createdAt;
}

function parseJournal(raw: string | null | undefined): JournalState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<JournalState>;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return migrate(parsed as Partial<JournalState> & { items: Item[] });
  } catch {
    return null;
  }
}

function load(): JournalState {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = parseJournal(raw);
  if (parsed) return parsed;
  if (raw) persistEnabled = false;
  return seed();
}

function shouldPrefer(candidate: JournalState, current: JournalState): boolean {
  if (candidate.items.length !== current.items.length) {
    return candidate.items.length > current.items.length;
  }
  const textLen = (state: JournalState) =>
    Object.values(state.notes).join("").length +
    (state.notebooks ?? []).reduce((sum, n) => sum + (n.html?.length ?? 0), 0);
  const notesA = textLen(candidate);
  const notesB = textLen(current);
  if (notesA !== notesB) return notesA > notesB;
  const latest = (state: JournalState) =>
    state.items.reduce((m, i) => Math.max(m, i.updatedAt || 0, i.createdAt || 0), 0);
  return latest(candidate) > latest(current);
}

async function saveDisk(json: string) {
  if (!isTauri()) return;
  try {
    await invoke("save_journal", { json });
  } catch {
    /* keep localStorage even if disk backup fails */
  }
}

async function readDisk(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return (await invoke<string | null>("load_journal")) ?? null;
  } catch {
    return null;
  }
}

export const useJournal = defineStore("journal", () => {
  // 隨手記小窗不持久化，避免用啟動時的舊資料蓋掉主窗剛寫入的內容。
  if (isCaptureMode()) persistEnabled = false;
  const data = ref<JournalState>(load());
  const view = ref<ViewId>("today");
  const selectedId = ref<string | null>(null);
  const activeListId = ref<string>(
    CATEGORIES.some((c) => c.id === data.value.lists[0]?.id) ? (data.value.lists[0]?.id ?? "work") : "work",
  );
  const captureOpen = ref(false);
  const paletteOpen = ref(false);
  const composerDraft = ref("");
  const composerFocusTick = ref(0);

  if (!CATEGORIES.some((c) => c.id === activeListId.value)) activeListId.value = "work";

  watch(
    data,
    (val) => {
      if (!persistEnabled) return;
      const json = JSON.stringify(val);
      localStorage.setItem(STORAGE_KEY, json);
      if (diskTimer) clearTimeout(diskTimer);
      diskTimer = setTimeout(() => {
        void saveDisk(json);
      }, 400);
    },
    { deep: true },
  );

  async function hydrateFromDisk() {
    const disk = parseJournal(await readDisk());
    if (disk) {
      if (!persistEnabled || shouldPrefer(disk, data.value)) {
        data.value = disk;
      }
    } else if (!persistEnabled) {
      return;
    }
    persistEnabled = true;
    const json = JSON.stringify(data.value);
    localStorage.setItem(STORAGE_KEY, json);
    await saveDisk(json);
  }

  const alive = computed(() => data.value.items.filter((i) => !i.deletedAt));
  const todayTick = ref(0);
  const today = computed(() => {
    void todayTick.value;
    return todayStr();
  });

  let dayTimer: ReturnType<typeof setTimeout> | null = null;

  function refreshToday() {
    todayTick.value += 1;
  }

  function msUntilNextLocalMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    return Math.max(1000, next.getTime() - now.getTime());
  }

  function watchCalendarDay() {
    if (dayTimer) clearTimeout(dayTimer);
    dayTimer = setTimeout(() => {
      refreshToday();
      watchCalendarDay();
    }, msUntilNextLocalMidnight());
  }

  const todayTasks = computed(() => {
    const t = today.value;
    const rows = alive.value.filter((i) => {
      if (i.type !== "task") return false;
      if (isProject(i)) return false;
      if (i.status === "open") return Boolean(i.dueOn && i.dueOn <= t);
      if (i.dueOn === t) return true;
      return i.loggedOn === t && !i.parentId;
    });
    return rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return byRank(a, b, "todayRank");
    });
  });

  const todayNote = computed(() => data.value.notes[today.value] ?? "");

  const notebooks = computed(() => data.value.notebooks);
  const activeNotebook = computed(
    () =>
      data.value.notebooks.find((n) => n.id === data.value.activeNotebookId) ??
      data.value.notebooks[0] ??
      null,
  );

  function selectNotebook(id: string) {
    if (data.value.notebooks.some((n) => n.id === id)) {
      data.value.activeNotebookId = id;
    }
  }

  function addNotebook(name: string): Notebook | null {
    const title = name.trim();
    if (!title) return null;
    const nb: Notebook = { id: uid(), name: title, html: "", createdAt: now() };
    data.value.notebooks.push(nb);
    data.value.activeNotebookId = nb.id;
    return nb;
  }

  function renameNotebook(id: string, name: string) {
    const nb = data.value.notebooks.find((n) => n.id === id);
    const title = name.trim();
    if (!nb || !title) return;
    nb.name = title;
  }

  function removeNotebook(id: string) {
    const idx = data.value.notebooks.findIndex((n) => n.id === id);
    if (idx < 0 || data.value.notebooks.length <= 1) return;
    data.value.notebooks.splice(idx, 1);
    if (data.value.activeNotebookId === id) {
      data.value.activeNotebookId = data.value.notebooks[0]?.id ?? null;
    }
  }

  function setNotebookHtml(id: string, html: string) {
    const nb = data.value.notebooks.find((n) => n.id === id);
    if (nb) nb.html = html;
  }

  const inboxItems = computed(() =>
    alive.value.filter((i) => i.type === "idea" && i.status === "open"),
  );

  const dueReminders = computed(() => {
    const t = today.value;
    return data.value.reminders
      .filter((r) => !r.firedAt && r.fireOn <= t)
      .map((r) => ({
        reminder: r,
        item: alive.value.find((i) => i.id === r.itemId && i.status === "open"),
      }))
      .filter((x): x is { reminder: Reminder; item: Item } => Boolean(x.item));
  });

  function touch(item: Item) {
    item.updatedAt = now();
  }

  function addItem(partial: Partial<Item> & Pick<Item, "type" | "title">): Item {
    const item: Item = {
      id: uid(),
      type: partial.type,
      title: partial.title.trim(),
      body: partial.body ?? "",
      status: partial.status ?? "open",
      important: partial.important ?? false,
      mark: partial.mark ?? null,
      dueOn: partial.dueOn ?? null,
      listId: partial.listId ?? null,
      parentId: partial.parentId ?? null,
      tagColor: partial.tagColor ?? null,
      collapsed: partial.collapsed ?? false,
      loggedOn: partial.loggedOn ?? null,
      rank: partial.rank ?? now(),
      todayRank: partial.todayRank ?? now(),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    data.value.items.unshift(item);
    if (item.important && item.dueOn && item.type === "task") {
      data.value.reminders.push(...remindersForItem(item));
    }
    selectedId.value = item.id;
    return item;
  }

  function capture(raw: string, fallback?: Partial<Item>) {
    const parsed = parseCapture(raw);
    const title = parsed.title || raw.trim();
    if (!title) return null;
    const type = fallback?.type ?? parsed.type;
    let dueOn = parsed.dueOn ?? fallback?.dueOn ?? null;
    let important = parsed.important || Boolean(fallback?.important);
    if (type === "task" && !dueOn && fallback?.dueOn) dueOn = fallback.dueOn;
    return addItem({
      type,
      title,
      important,
      dueOn,
      listId: fallback?.listId ?? null,
      parentId: fallback?.parentId ?? null,
      loggedOn: type === "log" ? today.value : null,
    });
  }

  function addProject(title: string, listId = activeListId.value) {
    const name = title.trim();
    if (!name) return null;
    return addItem({
      type: "task",
      title: name,
      listId,
      parentId: null,
      tagColor: categoryColor(listId),
      collapsed: false,
    });
  }

  function addMatter(parentId: string, raw: string) {
    const parent = data.value.items.find((i) => i.id === parentId);
    if (!parent) return null;
    const parsed = parseCapture(raw);
    const title = raw
      .trim()
      .replace(/^(todo|待辦)\s+/i, "")
      .replace(/(^|\s)(重要|[＊*★])(\s|$)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) return null;
    parent.collapsed = false;
    touch(parent);
    return addItem({
      type: "task",
      title,
      important: parsed.important,
      dueOn: parsed.dueOn,
      listId: parent.listId,
      parentId,
    });
  }

  function toggleCollapse(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item || !isProject(item)) return;
    item.collapsed = !item.collapsed;
    touch(item);
  }

  function setTagColor(id: string, color: string | null) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    item.tagColor = color;
    touch(item);
  }

  function complete(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item || item.type !== "task" || isProject(item)) return;
    item.status = "done";
    item.loggedOn = today.value;
    touch(item);
    for (const r of data.value.reminders) {
      if (r.itemId === id && !r.firedAt) r.firedAt = now();
    }
  }

  function reopen(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item || isProject(item)) return;
    item.status = "open";
    if (item.type === "task") item.loggedOn = null;
    touch(item);
  }

  function remove(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    const stamp = now();
    item.deletedAt = stamp;
    touch(item);
    if (isProject(item)) {
      for (const child of data.value.items) {
        if (child.parentId === id && !child.deletedAt) {
          child.deletedAt = stamp;
          touch(child);
        }
      }
    }
    if (selectedId.value === id) selectedId.value = null;
  }

  function dismissToday(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item || isProject(item)) return;
    item.dueOn = null;
    touch(item);
    data.value.reminders = data.value.reminders.filter((r) => r.itemId !== id || r.firedAt);
    if (selectedId.value === id) selectedId.value = null;
  }

  function moveRank(id: string, dir: "up" | "down" | "top", scope: "today" | "list") {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    const field: "rank" | "todayRank" = scope === "today" ? "todayRank" : "rank";
    const peers =
      scope === "list" && item.parentId
        ? mattersOf(item.parentId)
        : todayTasks.value.filter((row) => row.status === item.status);
    const idx = peers.findIndex((row) => row.id === id);
    if (idx < 0) return;
    const next = [...peers];
    if (dir === "top") {
      if (idx === 0) return;
      const [row] = next.splice(idx, 1);
      next.unshift(row);
    } else if (dir === "up") {
      if (idx === 0) return;
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    } else if (idx >= next.length - 1) {
      return;
    } else {
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    }
    next.forEach((row, i) => {
      row[field] = i;
      touch(row);
    });
  }

  function toggleImportant(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    item.important = !item.important;
    touch(item);
    data.value.reminders = data.value.reminders.filter((r) => r.itemId !== id);
    if (item.important && item.dueOn && item.type === "task" && item.status === "open") {
      data.value.reminders.push(...remindersForItem(item));
    }
  }

  function moveToToday(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item || isProject(item)) return;
    if (item.type === "idea") item.type = "task";
    item.dueOn = today.value;
    item.status = "open";
    touch(item);
    view.value = "today";
  }

  function ideaToTask(id: string, dueOn?: string | null, important?: boolean) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    item.type = "task";
    if (dueOn !== undefined) item.dueOn = dueOn;
    if (important !== undefined) item.important = important;
    touch(item);
    data.value.reminders = data.value.reminders.filter((r) => r.itemId !== id);
    if (item.important && item.dueOn) {
      data.value.reminders.push(...remindersForItem(item));
    }
  }

  function updateTitle(id: string, title: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    const next = title.trim();
    if (!next) return;
    item.title = next;
    touch(item);
  }

  function toggleMark(id: string, mark: Exclude<ItemMark, null>) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    item.mark = item.mark === mark ? null : mark;
    touch(item);
  }

  function setTodayNote(html: string) {
    data.value.notes[today.value] = html;
  }

  function clearTodayNote() {
    data.value.notes[today.value] = "";
  }

  function addLog(text: string) {
    const title = text.trim();
    if (!title) return;
    addItem({ type: "log", title, loggedOn: today.value });
  }

  function newForView() {
    composerFocusTick.value += 1;
  }

  function dismissReminder(id: string) {
    const r = data.value.reminders.find((x) => x.id === id);
    if (r) r.firedAt = now();
  }

  function listItems(listId: string) {
    return alive.value
      .filter((i) => isProject(i) && i.listId === listId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function mattersOf(parentId: string) {
    return alive.value
      .filter((i) => i.parentId === parentId)
      .sort((a, b) => byRank(a, b, "rank"));
  }

  function setDue(id: string, dueOn: string | null) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    item.dueOn = dueOn;
    if (dueOn && item.type === "idea") item.type = "task";
    touch(item);
    data.value.reminders = data.value.reminders.filter((r) => r.itemId !== id);
    if (item.important && item.dueOn && item.type === "task" && item.status === "open") {
      data.value.reminders.push(...remindersForItem(item));
    }
  }

  function setList(id: string, listId: string | null) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    item.listId = listId;
    if (isProject(item)) {
      for (const child of data.value.items) {
        if (child.parentId === id) child.listId = listId;
      }
    }
    touch(item);
  }

  function revealItem(id: string) {
    const item = data.value.items.find((i) => i.id === id);
    if (!item) return;
    selectedId.value = id;
    if (item.type === "idea") {
      view.value = "inbox";
      return;
    }
    const project = item.parentId
      ? data.value.items.find((i) => i.id === item.parentId)
      : isProject(item)
        ? item
        : null;
    if (project?.listId) {
      activeListId.value = project.listId;
      if (item.parentId) project.collapsed = false;
      view.value = "lists";
      return;
    }
    view.value = "today";
  }

  return {
    data,
    view,
    selectedId,
    activeListId,
    captureOpen,
    paletteOpen,
    composerDraft,
    composerFocusTick,
    today,
    todayTasks,
    todayNote,
    notebooks,
    activeNotebook,
    selectNotebook,
    addNotebook,
    renameNotebook,
    removeNotebook,
    setNotebookHtml,
    inboxItems,
    dueReminders,
    addItem,
    capture,
    addProject,
    addMatter,
    toggleCollapse,
    setTagColor,
    complete,
    reopen,
    remove,
    dismissToday,
    moveRank,
    toggleImportant,
    toggleMark,
    updateTitle,
    moveToToday,
    ideaToTask,
    setTodayNote,
    clearTodayNote,
    addLog,
    dismissReminder,
    listItems,
    mattersOf,
    setDue,
    setList,
    revealItem,
    newForView,
    hydrateFromDisk,
    refreshToday,
    watchCalendarDay,
  };
});
