<script setup lang="ts">
import { useJournal } from "../stores/journal";

defineProps<{ hint: string }>();
const journal = useJournal();

function submit() {
  const raw = journal.composerDraft.trim();
  if (!raw) return;
  const fallback =
    journal.view === "today"
      ? { type: "task" as const, dueOn: journal.today }
      : { type: "idea" as const };
  journal.capture(raw, fallback);
  journal.composerDraft = "";
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <input v-model="journal.composerDraft" :placeholder="hint" aria-label="新建" />
  </form>
</template>
