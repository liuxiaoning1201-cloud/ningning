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
  /** 四位數字，打開設定／改筆畫前要先輸入。 */
  teacherPin: string;
}

const DEFAULTS: Settings = { mascot: true, ghost: true, snap: true, teacherPin: '2468' };

function sanitizePin(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 4);
  return digits.length === 4 ? digits : DEFAULTS.teacherPin;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULTS, ...parsed, teacherPin: sanitizePin(parsed.teacherPin) };
    }
  } catch {
    // 用預設值
  }
  return { ...DEFAULTS };
}

export const useSettings = defineStore('settings', () => {
  const state = ref<Settings>(load());
  /** 這次開啟瀏覽器是否已通過老師密碼；不寫進 localStorage，下課關掉就鎖上。 */
  const teacherUnlocked = ref(false);

  watch(
    state,
    (val) => {
      localStorage.setItem(KEY, JSON.stringify(val));
    },
    { deep: true }
  );

  function unlockTeacher(pin: string): boolean {
    if (sanitizePin(pin) === state.value.teacherPin) {
      teacherUnlocked.value = true;
      return true;
    }
    return false;
  }

  function lockTeacher() {
    teacherUnlocked.value = false;
  }

  function setTeacherPin(next: string): boolean {
    const pin = sanitizePin(next);
    if (pin.length !== 4) return false;
    state.value.teacherPin = pin;
    return true;
  }

  return { state, teacherUnlocked, unlockTeacher, lockTeacher, setTeacherPin };
});
