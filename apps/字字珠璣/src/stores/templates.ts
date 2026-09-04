import { defineStore } from "pinia";
import type { GameTemplate } from "@/lib/types";
import { BUILTIN_TEMPLATES } from "@/lib/templates";

const STORAGE = "zizi:userTemplates";

function loadUser(): GameTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return [];
    const arr = JSON.parse(raw) as GameTemplate[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveUser(arr: GameTemplate[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(arr));
}

export const useTemplatesStore = defineStore("templates", {
  state: () => ({
    user: loadUser(),
  }),
  getters: {
    all(state): GameTemplate[] {
      return [...BUILTIN_TEMPLATES, ...state.user];
    },
    byId(): (id: string) => GameTemplate | undefined {
      return (id: string) => this.all.find((t) => t.id === id);
    },
  },
  actions: {
    add(t: GameTemplate) {
      this.user = [...this.user, { ...t, builtIn: false }];
      saveUser(this.user);
    },
    update(t: GameTemplate) {
      const i = this.user.findIndex((x) => x.id === t.id);
      if (i >= 0) {
        const next = this.user.slice();
        next[i] = t;
        this.user = next;
        saveUser(this.user);
      }
    },
    remove(id: string) {
      this.user = this.user.filter((x) => x.id !== id);
      saveUser(this.user);
    },
  },
});
