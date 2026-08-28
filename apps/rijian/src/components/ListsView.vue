<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useJournal } from "../stores/journal";
import { CATEGORIES } from "../types";
import ProjectBlock from "./ProjectBlock.vue";

const journal = useJournal();
const draft = ref("");
const titleInput = ref<HTMLInputElement | null>(null);

const projects = computed(() => journal.listItems(journal.activeListId));
const category = computed(() => CATEGORIES.find((c) => c.id === journal.activeListId));

function addProject() {
  const title = draft.value.trim();
  if (!title) return;
  journal.addProject(title);
  draft.value = "";
  nextTick(() => {
    document.querySelector<HTMLInputElement>(".project.is-on .matter-composer input")?.focus();
  });
}

function focusTitle() {
  nextTick(() => titleInput.value?.focus());
}

onMounted(focusTitle);

watch(
  () => journal.composerFocusTick,
  () => {
    if (journal.view === "lists") focusTitle();
  },
);

watch(
  () => journal.activeListId,
  () => focusTitle(),
);
</script>

<template>
  <section class="lists-page">
    <div class="cats">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        class="cat-btn"
        :class="{ 'is-on': journal.activeListId === cat.id }"
        type="button"
        @click="journal.activeListId = cat.id"
      >
        <span class="cat-mark" :style="{ background: cat.color }" />
        {{ cat.name }}
      </button>
    </div>
    <form class="project-composer composer" @submit.prevent="addProject">
      <input
        ref="titleInput"
        v-model="draft"
        :placeholder="`寫下「${category?.name ?? ''}」的項目標題`"
        aria-label="項目標題"
      />
    </form>
    <p v-if="!projects.length" class="empty">選好類別，寫下一則項目。事項收在抽屜裡，點「收」只留標題。</p>
    <ProjectBlock v-for="project in projects" :key="project.id" :project="project" />
  </section>
</template>
