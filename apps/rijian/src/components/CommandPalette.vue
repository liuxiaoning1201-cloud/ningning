<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useJournal } from "../stores/journal";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

const journal = useJournal();
const query = ref("");
const cursor = ref(0);
const input = ref<HTMLInputElement | null>(null);

const commands = computed<Command[]>(() => {
  const q = query.value.trim();
  const base: Command[] = [
    { id: "today", label: "前往今日", hint: "⌘1", run: () => (journal.view = "today") },
    { id: "inbox", label: "前往隨想", hint: "⌘2", run: () => (journal.view = "inbox") },
    { id: "lists", label: "前往清單", hint: "⌘3", run: () => (journal.view = "lists") },
    { id: "new", label: "打開日箋／去輸入框", hint: "⌘N", run: () => journal.newForView() },
  ];
  if (journal.selectedId) {
    base.push(
      { id: "star", label: "標為重要／取消", run: () => journal.toggleImportant(journal.selectedId!) },
      { id: "urgent", label: "蓋急／取消", run: () => journal.toggleMark(journal.selectedId!, "urgent") },
      { id: "ask", label: "蓋問／取消", run: () => journal.toggleMark(journal.selectedId!, "ask") },
      { id: "move", label: "拿到今天", run: () => journal.moveToToday(journal.selectedId!) },
      { id: "done", label: "完成選中待辦", hint: "⌘Enter", run: () => journal.complete(journal.selectedId!) },
    );
  }
  const hits = journal.data.items
    .filter((i) => !i.deletedAt && i.status === "open" && (!q || i.title.includes(q)))
    .slice(0, 8)
    .map((item) => ({
      id: `item-${item.id}`,
      label: item.title,
      hint: item.type === "idea" ? "隨想" : item.dueOn ?? "待辦",
      run: () => journal.revealItem(item.id),
    }));

  if (!q) return base;
  return [...base.filter((c) => c.label.includes(q)), ...hits];
});

function close() {
  journal.paletteOpen = false;
  query.value = "";
}

function run(cmd: Command) {
  cmd.run();
  close();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    cursor.value = (cursor.value + 1) % Math.max(commands.value.length, 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    cursor.value = (cursor.value - 1 + commands.value.length) % Math.max(commands.value.length, 1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const cmd = commands.value[cursor.value];
    if (cmd) run(cmd);
  }
}

onMounted(() => nextTick(() => input.value?.focus()));
</script>

<template>
  <div class="overlay" @click.self="close">
    <div class="panel">
      <h2>指令</h2>
      <input
        ref="input"
        v-model="query"
        class="capture-input"
        placeholder="跳頁、搜尋、標重要…"
        @keydown.esc.prevent="close"
        @keydown="onKey"
      />
      <div class="palette-list">
        <button
          v-for="(cmd, i) in commands"
          :key="cmd.id"
          class="palette-row"
          :class="{ 'is-on': i === cursor }"
          type="button"
          @click="run(cmd)"
        >
          <span>{{ cmd.label }}</span>
          <span class="help" style="margin: 0">{{ cmd.hint }}</span>
        </button>
        <p v-if="!commands.length" class="help">沒有相符的指令。</p>
      </div>
    </div>
  </div>
</template>
