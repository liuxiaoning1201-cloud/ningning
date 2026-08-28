<script setup lang="ts">
import { emit as emitTauri } from "@tauri-apps/api/event";
import { nextTick, onMounted, ref } from "vue";
import { useJournal } from "../stores/journal";
import { isCaptureMode, isTauri, hideCaptureWindow } from "../lib/tauri";

defineProps<{ embedded?: boolean }>();
const journal = useJournal();
const text = ref("");
const input = ref<HTMLInputElement | null>(null);
const standalone = isCaptureMode();

onMounted(() => {
  if (standalone) document.documentElement.style.background = "transparent";
  nextTick(() => input.value?.focus());
});

function persist() {
  const raw = text.value.trim();
  if (raw) {
    // 小窗不直接寫資料，把文字交給主窗保存，避免兩份資料互相覆蓋。
    if (isTauri() && standalone) void emitTauri("rijian-capture", raw);
    else journal.capture(raw, { type: "idea" });
  }
  text.value = "";
}

async function submit() {
  persist();
  await close();
}

async function cancel() {
  persist();
  await close();
}

async function close() {
  journal.captureOpen = false;
  if (isTauri() && standalone) await hideCaptureWindow();
}
</script>

<template>
  <div class="overlay" @click.self="cancel">
    <form class="panel" @submit.prevent="submit">
      <h2>隨手記</h2>
      <input
        ref="input"
        v-model="text"
        class="capture-input"
        placeholder="念頭會進隨想。關掉或 Enter 都會保存。"
        @keydown.esc.prevent="cancel"
      />
      <p class="help">Enter 送出　Esc 關閉　有字就會存進隨想</p>
    </form>
  </div>
</template>
