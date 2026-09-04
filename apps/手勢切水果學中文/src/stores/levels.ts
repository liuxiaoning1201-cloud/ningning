import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { STORAGE_KEY_LEVELS, STORAGE_KEY_SELECTED_LEVEL, defaultLevel, type Level } from '@/types/level';

/** 內建關卡模板（教師可複製／修改，不會被「還原」覆寫） */
export const BUILTIN_LEVELS: Level[] = [
  defaultLevel({
    id: 'lv_builtin_people',
    name: '人物名稱・限時 60s',
    topics: ['人物'],
    mode: 'timed',
    duration: 60,
    distractorRatio: 0,
    voice: 'mandarin',
    display: 'hanzi_pinyin',
    starTargets: [80, 160, 260],
    wrongPenalty: true,
    builtin: true,
  }),
  defaultLevel({
    id: 'lv_builtin_front_nasal',
    name: '前鼻音韻母・聽辨關',
    topics: ['前鼻音'],
    mode: 'timed',
    duration: 75,
    distractorRatio: 0.4,
    voice: 'mandarin',
    display: 'hanzi_pinyin',
    starTargets: [100, 180, 280],
    wrongPenalty: true,
    builtin: true,
  }),
  defaultLevel({
    id: 'lv_builtin_animal_count',
    name: '動物 15 顆・定量賽',
    topics: ['動物'],
    mode: 'count',
    targetCount: 15,
    distractorRatio: 0.3,
    voice: 'mandarin',
    display: 'hanzi_only',
    speedScale: 1.1,
    wrongPenalty: true,
    builtin: true,
  }),
  defaultLevel({
    id: 'lv_builtin_survival',
    name: '生存模式・自然詞',
    topics: ['自然'],
    mode: 'survival',
    missAllowance: 5,
    distractorRatio: 0.25,
    voice: 'mandarin',
    display: 'hanzi_pinyin',
    missPenalty: true,
    wrongPenalty: true,
    builtin: true,
  }),
];

function loadLocal(): Level[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEVELS);
    if (!raw) return BUILTIN_LEVELS.map((l) => ({ ...l }));
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return BUILTIN_LEVELS.map((l) => ({ ...l }));
    const levels = parsed.filter((l): l is Level => !!l && typeof (l as Level).id === 'string');
    const haveBuiltin = new Set(levels.map((l) => l.id));
    const missingBuiltins = BUILTIN_LEVELS.filter((l) => !haveBuiltin.has(l.id)).map((l) => ({ ...l }));
    return [...missingBuiltins, ...levels];
  } catch {
    return BUILTIN_LEVELS.map((l) => ({ ...l }));
  }
}

export const useLevelStore = defineStore('levels', () => {
  const items = ref<Level[]>(loadLocal());
  const selectedId = ref<string>(localStorage.getItem(STORAGE_KEY_SELECTED_LEVEL) || items.value[0]?.id || '');

  function persist() {
    localStorage.setItem(STORAGE_KEY_LEVELS, JSON.stringify(items.value));
  }

  function upsert(level: Level) {
    const idx = items.value.findIndex((l) => l.id === level.id);
    if (idx >= 0) items.value[idx] = level;
    else items.value.push(level);
    persist();
  }

  function patch(id: string, changes: Partial<Level>) {
    const idx = items.value.findIndex((l) => l.id === id);
    if (idx < 0) return;
    items.value[idx] = { ...items.value[idx], ...changes } as Level;
    persist();
  }

  function remove(id: string) {
    const l = items.value.find((x) => x.id === id);
    if (!l || l.builtin) return;
    items.value = items.value.filter((x) => x.id !== id);
    if (selectedId.value === id) selectedId.value = items.value[0]?.id || '';
    persist();
    localStorage.setItem(STORAGE_KEY_SELECTED_LEVEL, selectedId.value);
  }

  function duplicate(id: string): Level | null {
    const src = items.value.find((x) => x.id === id);
    if (!src) return null;
    const copy: Level = {
      ...src,
      id: `lv_${Math.random().toString(36).slice(2, 10)}`,
      name: `${src.name}（副本）`,
      builtin: false,
    };
    items.value.push(copy);
    persist();
    return copy;
  }

  function select(id: string) {
    selectedId.value = id;
    localStorage.setItem(STORAGE_KEY_SELECTED_LEVEL, id);
  }

  function getById(id: string): Level | null {
    return items.value.find((l) => l.id === id) || null;
  }

  const selected = computed<Level | null>(() => items.value.find((l) => l.id === selectedId.value) || items.value[0] || null);

  function resetBuiltins() {
    for (const b of BUILTIN_LEVELS) {
      const i = items.value.findIndex((x) => x.id === b.id);
      if (i >= 0) items.value[i] = { ...b };
      else items.value.unshift({ ...b });
    }
    persist();
  }

  return { items, selected, selectedId, upsert, patch, remove, duplicate, select, getById, resetBuiltins };
});
