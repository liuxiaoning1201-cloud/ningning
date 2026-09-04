<script setup lang="ts">
import { computed } from "vue";
import { useJournal } from "../stores/journal";
import Composer from "./Composer.vue";
import ItemRow from "./ItemRow.vue";

const journal = useJournal();

const openTasks = computed(() => journal.todayTasks.filter((i) => i.status === "open"));
const doneTasks = computed(() => journal.todayTasks.filter((i) => i.status === "done"));

function onRemove(item: { id: string; parentId: string | null }) {
  if (item.parentId) journal.dismissToday(item.id);
  else journal.remove(item.id);
}
</script>

<template>
  <section>
    <div class="section-label">此刻要做</div>
    <p v-if="!journal.todayTasks.length" class="empty">今日尚無待辦。在下方寫下一件即可。</p>
    <ItemRow
      v-for="(item, index) in openTasks"
      :key="item.id"
      :item="item"
      :selected="journal.selectedId === item.id"
      highlight-times
      reorder
      :show-today="false"
      :move-up-disabled="index === 0"
      :move-down-disabled="index === openTasks.length - 1"
      @select="journal.selectedId = item.id"
      @complete="journal.complete(item.id)"
      @reopen="journal.reopen(item.id)"
      @important="journal.toggleImportant(item.id)"
      @mark="journal.toggleMark(item.id, $event)"
      @rename="journal.updateTitle(item.id, $event)"
      @remove="onRemove(item)"
      @move="journal.moveRank(item.id, $event, 'today')"
    />
    <template v-if="doneTasks.length">
      <div class="section-label" style="margin-top: 22px">已完成</div>
      <ItemRow
        v-for="(item, index) in doneTasks"
        :key="item.id"
        :item="item"
        :selected="journal.selectedId === item.id"
        highlight-times
        reorder
        :show-today="false"
        :move-up-disabled="index === 0"
        :move-down-disabled="index === doneTasks.length - 1"
        @select="journal.selectedId = item.id"
        @complete="journal.complete(item.id)"
        @reopen="journal.reopen(item.id)"
        @important="journal.toggleImportant(item.id)"
        @mark="journal.toggleMark(item.id, $event)"
        @rename="journal.updateTitle(item.id, $event)"
        @remove="onRemove(item)"
        @move="journal.moveRank(item.id, $event, 'today')"
      />
    </template>
    <Composer hint="寫下今日待辦，Enter 即成一條" />
  </section>
</template>
