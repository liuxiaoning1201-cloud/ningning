import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { forgetChar } from '@/lib/charData';
import {
  clearCharStrokeLayout,
  ensureStrokeLayout,
  getStrokeLayout,
  getStrokeLayoutMap,
  hasStrokeLayout,
  insertLayoutItem,
  mergeStrokeLayoutMap,
  removeLayoutItem,
  restoreLayoutItemType,
  setLayoutItemType,
  subscribeStrokeLayouts,
  type StrokeLayout,
  type StrokeLayoutMap,
} from '@/lib/strokeLayouts';
import type { StrokeId } from '@/types';

export const useStrokeLayouts = defineStore('strokeLayouts', () => {
  const version = ref(0);
  subscribeStrokeLayouts(() => {
    version.value += 1;
  });

  const map = computed(() => {
    version.value;
    return getStrokeLayoutMap();
  });

  function layoutFor(ch: string): StrokeLayout | null {
    version.value;
    return getStrokeLayout(ch);
  }

  function has(ch: string): boolean {
    version.value;
    return hasStrokeLayout(ch);
  }

  function snapshot(ch: string, types: (StrokeId | null)[]): void {
    ensureStrokeLayout(ch, types);
    forgetChar(ch);
  }

  function setType(ch: string, index: number, id: StrokeId, types: (StrokeId | null)[]): void {
    ensureStrokeLayout(ch, types);
    setLayoutItemType(ch, index, id);
    forgetChar(ch);
  }

  function insert(ch: string, afterIndex: number, id: StrokeId, types: (StrokeId | null)[]): void {
    ensureStrokeLayout(ch, types);
    insertLayoutItem(ch, afterIndex, id);
    forgetChar(ch);
  }

  function remove(ch: string, index: number, types: (StrokeId | null)[]): boolean {
    ensureStrokeLayout(ch, types);
    const ok = removeLayoutItem(ch, index);
    if (ok) forgetChar(ch);
    return ok;
  }

  function restoreType(ch: string, index: number): boolean {
    const ok = restoreLayoutItemType(ch, index);
    if (ok) forgetChar(ch);
    return ok;
  }

  function clearChar(ch: string): void {
    clearCharStrokeLayout(ch);
    forgetChar(ch);
  }

  function importLayouts(incoming: StrokeLayoutMap): number {
    const n = mergeStrokeLayoutMap(incoming);
    for (const ch of Object.keys(incoming)) forgetChar(ch);
    return n;
  }

  return {
    map,
    layoutFor,
    has,
    snapshot,
    setType,
    insert,
    remove,
    restoreType,
    clearChar,
    importLayouts,
  };
});
