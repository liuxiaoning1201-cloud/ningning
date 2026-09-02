import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

/** 瀏覽器儲存鍵沿用舊名，以免老師已改的設定被清掉。 */
const KEY = 'caicaizi_settings_v1';

interface Settings {
  /** 吉祥物是否出現。課堂上十隻一起跳會很吵，可以關。 */
  mascot: boolean;
  /** 練習模式是否顯示淡淡的字影當底稿 */
  ghost: boolean;
  /** 練習模式是否吸附並鎖筆順 */
  snap: boolean;
}

const DEFAULTS: Settings = { mascot: true, ghost: true, snap: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // 用預設值
  }
  return { ...DEFAULTS };
}

export const useSettings = defineStore('settings', () => {
  const state = ref<Settings>(load());

  watch(
    state,
    (val) => {
      localStorage.setItem(KEY, JSON.stringify(val));
    },
    { deep: true }
  );

  return { state };
});
