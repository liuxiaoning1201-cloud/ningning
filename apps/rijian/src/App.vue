<script setup lang="ts">
import { listen } from "@tauri-apps/api/event";
import { nextTick, onMounted, watch } from "vue";
import CaptureModal from "./components/CaptureModal.vue";
import CommandPalette from "./components/CommandPalette.vue";
import InboxView from "./components/InboxView.vue";
import ListsView from "./components/ListsView.vue";
import TodayView from "./components/TodayView.vue";
import { useShortcuts } from "./composables/useShortcuts";
import { formatLongDate } from "./lib/dates";
import { isCaptureMode, isTauri } from "./lib/tauri";
import { useJournal } from "./stores/journal";
import { VIEWS } from "./types";

const journal = useJournal();
const captureMode = isCaptureMode();
useShortcuts();

const headings: Record<string, string> = {
  today: "今日",
  inbox: "隨想",
  lists: "清單",
};

function focusComposer() {
  nextTick(() => {
    const sel =
      journal.view === "lists"
        ? ".project-composer input"
        : ".composer input";
    document.querySelector<HTMLInputElement>(sel)?.focus();
  });
}

onMounted(() => {
  if (!captureMode) {
    void journal.hydrateFromDisk();
    focusComposer();
    if (isTauri()) {
      void listen<string>("rijian-capture", (event) => {
        const raw = String(event.payload ?? "").trim();
        if (raw) journal.capture(raw, { type: "idea" });
      });
    }
  }
  if (!isTauri() && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
});

watch(
  () => journal.composerFocusTick,
  () => {
    if (!captureMode) focusComposer();
  },
);

watch(
  () => journal.view,
  () => {
    if (!captureMode) focusComposer();
  },
);
</script>

<template>
  <div v-if="captureMode" class="app-root capture-only">
    <CaptureModal />
  </div>
  <div v-else class="app-root">
    <div class="shell">
      <nav class="nav">
        <div class="brand">日箋</div>
        <button
          v-for="item in VIEWS"
          :key="item.id"
          class="nav-btn"
          :class="{ 'is-on': journal.view === item.id }"
          type="button"
          @click="journal.view = item.id"
        >
          {{ item.label }}
        </button>
        <div class="nav-hint">⌘K 指令</div>
      </nav>
      <main class="sheet">
        <header class="sheet-head">
          <div>
            <div class="date-kicker">{{ formatLongDate(journal.today) }}</div>
            <div class="view-title">{{ headings[journal.view] }}</div>
          </div>
        </header>
        <div class="scroll">
          <TodayView v-if="journal.view === 'today'" />
          <InboxView v-else-if="journal.view === 'inbox'" />
          <ListsView v-else />
        </div>
      </main>
    </div>
    <CommandPalette v-if="journal.paletteOpen" />
  </div>
</template>
