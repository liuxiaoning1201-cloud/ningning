export type ItemType = "idea" | "task" | "log";
export type ItemStatus = "open" | "done";
export type ViewId = "today" | "inbox" | "lists";
export type ReminderKind = "minus_30d" | "minus_7d" | "minus_1d";
export type ItemMark = "urgent" | "ask" | null;

export const MARKS: { id: Exclude<ItemMark, null>; label: string }[] = [
  { id: "urgent", label: "急" },
  { id: "ask", label: "問" },
];

export const CATEGORIES: { id: string; name: string; sort: number; color: string }[] = [
  { id: "work", name: "工作", sort: 0, color: "#9c3d2f" },
  { id: "study", name: "學習", sort: 1, color: "#3d5c6e" },
  { id: "life", name: "生活", sort: 2, color: "#4a6b52" },
  { id: "play", name: "娛樂", sort: 3, color: "#c4a35a" },
  { id: "other", name: "其他", sort: 4, color: "#5c4e6e" },
];

export const TAG_COLORS: { id: string; color: string | null; label: string }[] = [
  { id: "cinnabar", color: "#9c3d2f", label: "朱砂" },
  { id: "azurite", color: "#3d5c6e", label: "石青" },
  { id: "pine", color: "#4a6b52", label: "松綠" },
  { id: "gamboge", color: "#c4a35a", label: "藤黃" },
  { id: "inkstone", color: "#5c4e6e", label: "黛" },
  { id: "plain", color: null, label: "素" },
];

export function categoryColor(listId: string | null): string | null {
  return CATEGORIES.find((c) => c.id === listId)?.color ?? null;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  body: string;
  status: ItemStatus;
  important: boolean;
  mark: ItemMark;
  dueOn: string | null;
  listId: string | null;
  parentId: string | null;
  tagColor: string | null;
  collapsed: boolean;
  loggedOn: string | null;
  rank: number;
  todayRank: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export function isProject(item: Item): boolean {
  return item.type === "task" && !item.parentId && Boolean(item.listId);
}

export function isMatter(item: Item): boolean {
  return item.type === "task" && Boolean(item.parentId);
}

export interface List {
  id: string;
  name: string;
  sort: number;
}

export interface Reminder {
  id: string;
  itemId: string;
  fireOn: string;
  kind: ReminderKind;
  firedAt: number | null;
}

export interface Notebook {
  id: string;
  name: string;
  html: string;
  createdAt: number;
}

export interface JournalState {
  items: Item[];
  lists: List[];
  reminders: Reminder[];
  notes: Record<string, string>;
  notebooks: Notebook[];
  activeNotebookId: string | null;
}

export const VIEWS: { id: ViewId; label: string; shortcut: string }[] = [
  { id: "today", label: "今日", shortcut: "⌘1" },
  { id: "inbox", label: "隨想", shortcut: "⌘2" },
  { id: "lists", label: "清單", shortcut: "⌘3" },
];
