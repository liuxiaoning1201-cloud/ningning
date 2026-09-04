import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { forgetChar } from '@/lib/charData';
import {
  clearCharStrokeLocks,
  clearStrokeLock,
  getStrokeLockMap,
  getStrokeLocks,
  mergeStrokeLockMap,
  setStrokeLock,
  subscribeStrokeLocks,
  type StrokeLockMap,
} from '@/lib/strokeLocks';
import type { StrokeId } from '@/types';

export const useStrokeLocks = defineStore('strokeLocks', () => {
  const version = ref(0);
  subscribeStrokeLocks(() => {
    version.value += 1;
  });

  const map = computed(() => {
    version.value;
    return getStrokeLockMap();
  });

  function locksFor(ch: string): Record<number, StrokeId> {
    version.value;
    return getStrokeLocks(ch);
  }

  function lock(ch: string, index: number, id: StrokeId): void {
    setStrokeLock(ch, index, id);
    forgetChar(ch);
  }

  function unlock(ch: string, index: number): void {
    clearStrokeLock(ch, index);
    forgetChar(ch);
  }

  function unlockChar(ch: string): void {
    clearCharStrokeLocks(ch);
    forgetChar(ch);
  }

  function importLocks(incoming: StrokeLockMap): number {
    const n = mergeStrokeLockMap(incoming);
    for (const ch of Object.keys(incoming)) forgetChar(ch);
    return n;
  }

  return { map, locksFor, lock, unlock, unlockChar, importLocks };
});
