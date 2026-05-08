<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal animate-pop">
      <div class="modal-head">
        <span class="qa-type-badge">{{ typeLabel }}</span>
        <span class="qa-target muted">指向 ({{ targetCell.r + 1 }}, {{ targetCell.c + 1 }})</span>
      </div>
      <h2 class="qa-prompt">{{ card.prompt }}</h2>
      <p v-if="card.hint" class="qa-hint">提示：{{ card.hint }}</p>

      <div class="qa-options">
        <button
          v-for="(opt, i) in card.options"
          :key="i"
          class="qa-option"
          :class="optionClass(i)"
          :disabled="answered"
          @click="onChoose(i)"
        >
          <span class="qa-option-letter">{{ "ABCD"[i] }}</span>
          <span class="qa-option-text">{{ opt }}</span>
        </button>
      </div>

      <div v-if="answered" class="qa-result">
        <span v-if="lastChoice === card.correctIndex" class="qa-correct">✓ 答對！可以落子了</span>
        <span v-else class="qa-wrong">✗ 答錯了，跳過此回合（正確答案：{{ "ABCD"[card.correctIndex] }} {{ card.options[card.correctIndex] }}）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { QuestionCard, QuestionType } from "@/lib/types";

const props = defineProps<{
  card: QuestionCard;
  targetCell: { r: number; c: number };
}>();

const emit = defineEmits<{
  (e: "answer", optionIndex: number): void;
  (e: "close"): void;
}>();

const lastChoice = ref<number | null>(null);
const answered = computed(() => lastChoice.value !== null);

const typeLabel = computed(() => labelForType(props.card.type));

function labelForType(t: QuestionType): string {
  switch (t) {
    case "phonetic": return "注音題";
    case "definition": return "詞義題";
    case "compose": return "組詞題";
    case "idiom-meaning": return "成語意義題";
    case "near-form": return "形近字題";
    default: return "中文題";
  }
}

function optionClass(i: number) {
  if (lastChoice.value === null) return "";
  if (i === props.card.correctIndex) return "is-correct";
  if (i === lastChoice.value && i !== props.card.correctIndex) return "is-wrong";
  return "is-faded";
}

function onChoose(i: number) {
  if (lastChoice.value !== null) return;
  lastChoice.value = i;
  emit("answer", i);
  setTimeout(() => emit("close"), 1500);
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(45, 36, 25, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
  animation: fadeIn 0.2s ease both;
}

.modal {
  background: var(--card-bg);
  border: 2px solid var(--gold);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  max-width: 460px;
  width: 100%;
  box-shadow: var(--shadow-deep);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.qa-type-badge {
  background: linear-gradient(135deg, var(--crimson), var(--crimson-soft));
  color: white;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
}

.qa-target { font-size: 0.78rem; }

.qa-prompt {
  font-family: var(--font-heading);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 0.5rem;
  line-height: 1.4;
}

.qa-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0 0 1rem;
  font-style: italic;
}

.qa-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

@media (max-width: 460px) {
  .qa-options { grid-template-columns: 1fr; }
}

.qa-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border: 1.5px solid var(--border-deep);
  background: white;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  font-size: 0.95rem;
  text-align: left;
}
.qa-option:hover:not(:disabled) {
  border-color: var(--crimson);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}
.qa-option:disabled { cursor: not-allowed; }

.qa-option-letter {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--paper-deep);
  color: var(--ink-soft);
  font-weight: 700;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.qa-option-text {
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: var(--ink);
}

.qa-option.is-correct {
  border-color: var(--jade);
  background: rgba(107, 142, 99, 0.12);
  animation: correctFlash 0.5s ease;
}
.qa-option.is-correct .qa-option-letter { background: var(--jade); color: white; }

.qa-option.is-wrong {
  border-color: var(--crimson);
  background: rgba(193, 53, 45, 0.1);
  animation: shake 0.4s ease;
}
.qa-option.is-wrong .qa-option-letter { background: var(--crimson); color: white; }

.qa-option.is-faded { opacity: 0.4; }

@keyframes correctFlash {
  0% { background: rgba(107, 142, 99, 0.4); }
  100% { background: rgba(107, 142, 99, 0.12); }
}

.qa-result {
  text-align: center;
  padding: 0.6rem;
  border-radius: 10px;
  font-weight: 600;
}
.qa-correct { color: var(--jade); }
.qa-wrong { color: var(--crimson); }
</style>
