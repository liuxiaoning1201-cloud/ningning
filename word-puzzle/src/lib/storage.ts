import type { PuzzleSet, WordBank, SentenceBank } from "./types";
import { STORAGE_KEYS } from "./types";

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setItem(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getWordBanks(): WordBank[] {
  return getItem(STORAGE_KEYS.WORD_BANKS, []);
}

export function setWordBanks(banks: WordBank[]): void {
  setItem(STORAGE_KEYS.WORD_BANKS, banks);
}

export function getSentenceBanks(): SentenceBank[] {
  return getItem(STORAGE_KEYS.SENTENCE_BANKS, []);
}

export function setSentenceBanks(banks: SentenceBank[]): void {
  setItem(STORAGE_KEYS.SENTENCE_BANKS, banks);
}

export function getPuzzleSets(): PuzzleSet[] {
  return getItem(STORAGE_KEYS.PUZZLE_SETS, []);
}

export function setPuzzleSets(sets: PuzzleSet[]): void {
  setItem(STORAGE_KEYS.PUZZLE_SETS, sets);
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
