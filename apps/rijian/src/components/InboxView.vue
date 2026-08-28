<script setup lang="ts">
import { useJournal } from "../stores/journal";
import Composer from "./Composer.vue";
import ItemRow from "./ItemRow.vue";
import NotePaper from "./NotePaper.vue";

const journal = useJournal();
</script>

<template>
  <section class="inbox-page">
    <NotePaper />
    <div class="quick-zone">
      <div class="quick-divider">隨手記</div>
      <ItemRow
        v-for="item in journal.inboxItems"
        :key="item.id"
        :item="item"
        :selected="journal.selectedId === item.id"
        @select="journal.selectedId = item.id"
        @complete="journal.ideaToTask(item.id, journal.today)"
        @important="journal.toggleImportant(item.id)"
        @mark="journal.toggleMark(item.id, $event)"
        @rename="journal.updateTitle(item.id, $event)"
        @today="journal.moveToToday(item.id)"
        @remove="journal.remove(item.id)"
      />
      <Composer hint="隨手記一筆念頭，Enter 收進來" />
    </div>
  </section>
</template>
