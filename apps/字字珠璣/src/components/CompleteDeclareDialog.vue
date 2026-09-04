<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal animate-pop">
      <h2 class="modal-title">宣告連線</h2>
      <p class="modal-desc">在棋盤上依序點選你已落子的格子（最少 {{ minLen }} 字），完成後填入你想宣告的內容。</p>

      <div v-if="selectedCells.length > 0" class="selected-line">
        <div class="selected-cells">
          <span
            v-for="(c, i) in selectedCells"
            :key="i"
            class="selected-pill"
          >
            {{ c.ch || "·" }}
          </span>
        </div>
        <div class="selected-text">{{ selectedText }}</div>
      </div>

      <div class="declare-input-group">
        <label>宣告內容</label>
        <input
          v-model="declaredText"
          type="text"
          placeholder="輸入完整的成語/詩句/句子"
          @keyup.enter="onSubmit"
        />
      </div>

      <div v-if="dictHint.length > 0" class="dict-hints">
        <span class="muted">字典中相似條目：</span>
        <button
          v-for="hint in dictHint"
          :key="hint"
          class="hint-chip"
          @click="declaredText = hint"
        >
          {{ hint }}
        </button>
      </div>

      <div v-if="errorMessage" class="error-msg animate-shake">{{ errorMessage }}</div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="$emit('close')">取消</button>
        <button
          class="btn btn-primary"
          :disabled="!canSubmit"
          @click="onSubmit"
        >
          宣告勝利
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ContentType } from "@/lib/types";
import { getContentSeeds } from "@/lib/content";

const props = defineProps<{
  selectedCells: { r: number; c: number; ch?: string }[];
  contentType: ContentType;
  customTexts?: string[];
}>();

const emit = defineEmits<{
  (e: "submit", text: string): void;
  (e: "close"): void;
}>();

const declaredText = ref("");
const errorMessage = ref("");

const minLen = computed(() => {
  switch (props.contentType) {
    case "idiom": return 4;
    case "poem-5": return 5;
    case "poem-7": return 7;
    case "sentence": return 5;
    default: return 2;
  }
});

const selectedText = computed(() => props.selectedCells.map((c) => c.ch || "").join(""));

const canSubmit = computed(() => declaredText.value.trim().length >= minLen.value && props.selectedCells.length >= minLen.value);

const dictHint = computed(() => {
  const seeds = getContentSeeds(props.contentType, props.customTexts);
  const text = selectedText.value;
  return seeds
    .filter((s) => text.includes(s) || s.length === text.length)
    .slice(0, 5);
});

function onSubmit() {
  errorMessage.value = "";
  if (!canSubmit.value) {
    errorMessage.value = "宣告長度不足";
    return;
  }
  emit("submit", declaredText.value.trim());
}
</script>

<style scoped>
.modal-mask {
  position: fixed; inset: 0;
  background: rgba(45, 36, 25, 0.55);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; z-index: 100;
  animation: fadeIn 0.2s ease both;
}
.modal {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  max-width: 460px; width: 100%;
  box-shadow: var(--shadow-deep);
}
.modal-title {
  font-family: var(--font-heading);
  font-size: 1.4rem;
  margin: 0 0 0.4rem;
  color: var(--ink);
}
.modal-desc { color: var(--text-muted); font-size: 0.9rem; margin: 0 0 1rem; }

.selected-line {
  background: var(--paper-deep);
  border-radius: 12px;
  padding: 0.7rem;
  margin-bottom: 1rem;
}
.selected-cells {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  justify-content: center;
  margin-bottom: 0.4rem;
}
.selected-pill {
  width: 36px; height: 36px;
  display: inline-flex; align-items: center; justify-content: center;
  background: white;
  border: 1.5px solid var(--gold);
  border-radius: 8px;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--ink);
}
.selected-text {
  text-align: center;
  font-family: var(--font-heading);
  color: var(--gold-deep);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.declare-input-group { margin-bottom: 0.8rem; }

.dict-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1rem;
}
.hint-chip {
  background: rgba(200, 148, 58, 0.12);
  color: var(--gold-deep);
  border: 1px solid rgba(200, 148, 58, 0.3);
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: var(--font-heading);
  transition: all 0.15s ease;
}
.hint-chip:hover {
  background: rgba(200, 148, 58, 0.2);
}

.error-msg {
  background: rgba(193, 53, 45, 0.1);
  color: var(--crimson);
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  margin-bottom: 0.8rem;
  font-size: 0.88rem;
}

.modal-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
}
</style>
