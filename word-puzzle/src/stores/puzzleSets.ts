import { defineStore } from "pinia";
import type { PuzzleSet } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

function load<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function save(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export const usePuzzleSetsStore = defineStore("puzzleSets", {
  state: () => ({
    sets: load<PuzzleSet[]>(STORAGE_KEYS.PUZZLE_SETS, []),
  }),
  actions: {
    setSets(sets: PuzzleSet[]) {
      this.sets = sets;
      save(STORAGE_KEYS.PUZZLE_SETS, sets);
    },
    addSet(set: PuzzleSet) {
      this.sets = [...this.sets, set];
      save(STORAGE_KEYS.PUZZLE_SETS, this.sets);
    },
    updateSet(set: PuzzleSet) {
      const i = this.sets.findIndex((s) => s.id === set.id);
      if (i >= 0) {
        this.sets = this.sets.slice(0, i).concat(set).concat(this.sets.slice(i + 1));
        save(STORAGE_KEYS.PUZZLE_SETS, this.sets);
      }
    },
    removeSet(id: string) {
      this.sets = this.sets.filter((s) => s.id !== id);
      save(STORAGE_KEYS.PUZZLE_SETS, this.sets);
    },
  },
});
