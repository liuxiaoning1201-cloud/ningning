<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useJournal } from "../stores/journal";
import type { Item } from "../types";
import { TAG_COLORS } from "../types";
import ItemRow from "./ItemRow.vue";

const props = defineProps<{
  project: Item;
}>();

const journal = useJournal();
const draft = ref("");
const editing = ref(false);
const titleDraft = ref(props.project.title);
const titleInput = ref<HTMLInputElement | null>(null);
const matterInput = ref<HTMLInputElement | null>(null);

const selected = computed(() => journal.selectedId === props.project.id);
const matters = computed(() => journal.mattersOf(props.project.id));
const openCount = computed(() => matters.value.filter((m) => m.status === "open").length);

watch(
  () => props.project.title,
  (title) => {
    if (!editing.value) titleDraft.value = title;
  },
);

function select() {
  journal.selectedId = props.project.id;
}

async function startEdit() {
  select();
  editing.value = true;
  titleDraft.value = props.project.title;
  await nextTick();
  titleInput.value?.focus();
  titleInput.value?.select();
}

function commitTitle() {
  editing.value = false;
  journal.updateTitle(props.project.id, titleDraft.value);
}

function addMatter() {
  const raw = draft.value.trim();
  if (!raw) return;
  journal.addMatter(props.project.id, raw);
  draft.value = "";
  nextTick(() => matterInput.value?.focus());
}

function paint(color: string | null) {
  journal.setTagColor(props.project.id, color);
}
</script>

<template>
  <article
    class="project"
    :class="{ 'is-on': selected, 'is-folded': project.collapsed }"
    :style="{ '--tag': project.tagColor || 'var(--hair)' }"
  >
    <header class="project-face" @click="select">
      <span class="tag-dot" :class="{ 'is-plain': !project.tagColor }" aria-hidden="true" />
      <input
        v-if="editing"
        ref="titleInput"
        v-model="titleDraft"
        class="title-edit"
        @click.stop
        @blur="commitTitle"
        @keydown.enter.prevent="commitTitle"
        @keydown.esc.prevent="editing = false; titleDraft = project.title"
      />
      <div v-else class="project-title" @dblclick.stop="startEdit">{{ project.title }}</div>
      <div class="project-meta">
        <span v-if="project.collapsed && openCount" class="project-count">{{ openCount }}</span>
        <div v-if="selected" class="tag-picks" @click.stop>
          <button
            v-for="tag in TAG_COLORS"
            :key="tag.id"
            class="ink-dot"
            :class="{ 'is-plain': !tag.color, 'is-on': project.tagColor === tag.color }"
            type="button"
            :title="tag.label"
            :style="tag.color ? { background: tag.color } : undefined"
            @click="paint(tag.color)"
          />
        </div>
        <div class="row-actions">
          <button class="ghost" type="button" @click.stop="journal.toggleCollapse(project.id)">
            {{ project.collapsed ? "展" : "收" }}
          </button>
          <button class="ghost" type="button" @click.stop="journal.remove(project.id)">刪</button>
        </div>
      </div>
    </header>
    <div class="project-drawer" :class="{ 'is-open': !project.collapsed }">
      <div class="project-drawer-inner" :inert="project.collapsed">
        <ItemRow
          v-for="(item, index) in matters"
          :key="item.id"
          :item="item"
          :selected="journal.selectedId === item.id"
          highlight-times
          reorder
          :move-up-disabled="index === 0"
          :move-down-disabled="index === matters.length - 1"
          @select="journal.selectedId = item.id"
          @complete="journal.complete(item.id)"
          @reopen="journal.reopen(item.id)"
          @important="journal.toggleImportant(item.id)"
          @mark="journal.toggleMark(item.id, $event)"
          @rename="journal.updateTitle(item.id, $event)"
          @today="journal.moveToToday(item.id)"
          @remove="journal.remove(item.id)"
          @move="journal.moveRank(item.id, $event, 'list')"
        />
        <form class="matter-composer" @submit.prevent="addMatter">
          <input
            ref="matterInput"
            v-model="draft"
            placeholder="寫下一件事項，有日期或鐘點會自動標出"
            aria-label="新建事項"
            @focus="select"
          />
        </form>
      </div>
    </div>
  </article>
</template>
