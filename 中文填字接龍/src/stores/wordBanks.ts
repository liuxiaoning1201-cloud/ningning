import { defineStore } from "pinia";
import type { WordBank } from "@/lib/types";
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

export const useWordBanksStore = defineStore("wordBanks", {
  state: () => ({
    banks: load<WordBank[]>(STORAGE_KEYS.WORD_BANKS, []),
  }),
  actions: {
    setBanks(banks: WordBank[]) {
      this.banks = banks;
      save(STORAGE_KEYS.WORD_BANKS, banks);
    },
    addBank(bank: WordBank) {
      this.banks = [...this.banks, bank];
      save(STORAGE_KEYS.WORD_BANKS, this.banks);
    },
    updateBank(bank: WordBank) {
      const i = this.banks.findIndex((b) => b.id === bank.id);
      if (i >= 0) {
        this.banks = this.banks.slice(0, i).concat(bank).concat(this.banks.slice(i + 1));
        save(STORAGE_KEYS.WORD_BANKS, this.banks);
      }
    },
    removeBank(id: string) {
      this.banks = this.banks.filter((b) => b.id !== id);
      save(STORAGE_KEYS.WORD_BANKS, this.banks);
    },
  },
});
