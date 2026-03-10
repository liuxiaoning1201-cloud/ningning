import { defineStore } from "pinia";
import type { CrosswordPuzzle, GameMode } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

export interface GameSettings {
  difficulty: number;
  showHints: boolean;
  mode: GameMode;
}

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

const defaultSettings: GameSettings = {
  difficulty: 1,
  showHints: true,
  mode: "practice",
};

export const useGameSessionStore = defineStore("gameSession", {
  state: () => ({
    currentPuzzle: null as CrosswordPuzzle | null,
    userAnswers: {} as Record<string, string>, // cell key -> value
    showResult: false,
    settings: load<GameSettings>(STORAGE_KEYS.GAME_SETTINGS, defaultSettings),
  }),
  actions: {
    setCurrentPuzzle(puzzle: CrosswordPuzzle | null) {
      this.currentPuzzle = puzzle;
      this.userAnswers = {};
      this.showResult = false;
    },
    setAnswer(cellKey: string, value: string) {
      this.userAnswers = { ...this.userAnswers, [cellKey]: value };
    },
    setShowResult(show: boolean) {
      this.showResult = show;
    },
    setSettings(s: Partial<GameSettings>) {
      this.settings = { ...this.settings, ...s };
      save(STORAGE_KEYS.GAME_SETTINGS, this.settings);
    },
  },
});
