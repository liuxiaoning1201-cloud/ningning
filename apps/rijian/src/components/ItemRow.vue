<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { formatShortDate, todayStr } from "../lib/dates";
import { highlightTime } from "../lib/highlightTime";
import type { Item, ItemMark } from "../types";

const props = withDefaults(
  defineProps<{
    item: Item;
    selected?: boolean;
    highlightTimes?: boolean;
    showToday?: boolean;
    reorder?: boolean;
    moveUpDisabled?: boolean;
    moveDownDisabled?: boolean;
  }>(),
  {
    highlightTimes: false,
    showToday: true,
    reorder: false,
    moveUpDisabled: false,
    moveDownDisabled: false,
  },
);

const emit = defineEmits<{
  select: [];
  complete: [];
  reopen: [];
  important: [];
  mark: [mark: Exclude<ItemMark, null>];
  rename: [title: string];
  today: [];
  remove: [];
  move: [dir: "up" | "down" | "top"];
}>();

const editing = ref(false);
const draft = ref(props.item.title);
const editInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.item.title,
  (title) => {
    if (!editing.value) draft.value = title;
  },
);

async function startEdit() {
  emit("select");
  editing.value = true;
  draft.value = props.item.title;
  await nextTick();
  editInput.value?.focus();
  editInput.value?.select();
}

function commit() {
  editing.value = false;
  emit("rename", draft.value);
}

const titleParts = computed(() =>
  props.highlightTimes ? highlightTime(props.item.title) : [{ text: props.item.title, mark: false }],
);

const alreadyToday = computed(() => Boolean(props.item.dueOn && props.item.dueOn <= todayStr()));
</script>

<template>
  <div class="item" :class="{ 'is-on': selected, 'is-done': item.status === 'done' }" @click="emit('select')">
    <button
      v-if="item.type === 'task'"
      class="check"
      :class="{ 'is-on': item.status === 'done' }"
      :aria-label="item.status === 'done' ? '重新打開' : '完成'"
      @click.stop="item.status === 'done' ? emit('reopen') : emit('complete')"
    >
      <span v-if="item.status === 'done'">✓</span>
    </button>
    <div v-else class="check" style="border-color: transparent" />
    <div>
      <input
        v-if="editing"
        ref="editInput"
        v-model="draft"
        class="title-edit"
        @click.stop
        @blur="commit"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="editing = false; draft = item.title"
      />
      <div v-else class="item-title" @dblclick.stop="startEdit">
        <template v-for="(part, i) in titleParts" :key="i">
          <mark v-if="part.mark" class="time-mark">{{ part.text }}</mark>
          <span v-else>{{ part.text }}</span>
        </template>
      </div>
    </div>
    <div class="item-meta">
      <span v-if="item.dueOn" class="item-date">{{ formatShortDate(item.dueOn) }}</span>
      <div class="mark-actions">
        <button
          class="icon-btn"
          :class="{ 'is-on': item.important }"
          type="button"
          title="重要"
          aria-label="重要"
          @click.stop="emit('important')"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 1.35 9.76 5.6l4.64.4-3.56 3.08 1.08 4.54L8 11.4l-3.92 2.22 1.08-4.54L1.6 6l4.64-.4Z"
            />
          </svg>
        </button>
        <button
          class="icon-btn seal-btn"
          :class="{ 'is-on': item.mark === 'urgent' }"
          type="button"
          title="急"
          aria-label="急"
          @click.stop="emit('mark', 'urgent')"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1.1" />
            <path d="M8 4.8v4.1" />
            <circle cx="8" cy="11.2" r="0.85" />
          </svg>
        </button>
        <button
          class="icon-btn ask-btn"
          :class="{ 'is-on': item.mark === 'ask' }"
          type="button"
          title="問"
          aria-label="問"
          @click.stop="emit('mark', 'ask')"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.4" />
            <path d="M6.15 6.2a1.9 1.9 0 1 1 2.35 1.85c-.55.28-.85.62-.85 1.25" />
            <circle cx="8" cy="11.15" r="0.7" />
          </svg>
        </button>
      </div>
      <div class="row-actions">
        <button
          v-if="showToday && item.status === 'open' && !alreadyToday"
          class="ghost"
          type="button"
          @click.stop="emit('today')"
        >
          拿到今天
        </button>
        <button class="ghost" type="button" @click.stop="emit('remove')">刪</button>
      </div>
    </div>
    <div v-if="reorder" class="rank-col">
      <button
        class="rank-btn rank-top"
        type="button"
        title="置頂"
        aria-label="置頂"
        :disabled="moveUpDisabled"
        @click.stop="emit('move', 'top')"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 2.2h8M6 10V4.2M3.4 6.4 6 3.8l2.6 2.6" />
        </svg>
      </button>
      <button
        class="rank-btn"
        type="button"
        title="上移"
        aria-label="上移"
        :disabled="moveUpDisabled"
        @click.stop="emit('move', 'up')"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 9.2V3.2M3.3 5.8 6 3.2l2.7 2.6" />
        </svg>
      </button>
      <button
        class="rank-btn"
        type="button"
        title="下移"
        aria-label="下移"
        :disabled="moveDownDisabled"
        @click.stop="emit('move', 'down')"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2.8v6M3.3 6.2 6 8.8l2.7-2.6" />
        </svg>
      </button>
    </div>
  </div>
</template>
