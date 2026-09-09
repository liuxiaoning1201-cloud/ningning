<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { loadGloss, loadWordGloss, rankWords, type CharGlossData } from '@/lib/moedict';
import { useWordbooks } from '@/stores/wordbooks';

const props = defineProps<{ char: string }>();

const books = useWordbooks();

const gloss = ref<CharGlossData | null>(null);
const loading = ref(false);
const showEnglish = ref(false);
const openWord = ref('');
const openWordText = ref('');

/** 字簿裡的字算「學生正在學的」，用這些字組成的詞排前面。 */
const familiar = computed(() => new Set(books.activeChars));

const MAX_SHOWN_WORDS = 10;

const words = computed(() => {
  if (!gloss.value) return [];
  return rankWords(gloss.value.words, gloss.value.char, familiar.value).slice(0, MAX_SHOWN_WORDS);
});

const bopomofoText = computed(() => gloss.value?.bopomofo.join('／') ?? '');

const metaText = computed(() => {
  const data = gloss.value;
  if (!data) return '';
  const parts: string[] = [];
  if (data.radical) parts.push(`部首 ${data.radical}`);
  if (data.strokeCount) parts.push(`${data.strokeCount} 畫`);
  return parts.join(' · ');
});

/** 換字時先清空，避免上一個字的釋義閃一下。 */
let token = 0;
watch(
  () => props.char,
  async (ch) => {
    const mine = ++token;
    gloss.value = null;
    showEnglish.value = false;
    openWord.value = '';
    openWordText.value = '';
    if (!ch) return;
    loading.value = true;
    const data = await loadGloss(ch);
    if (mine !== token) return;
    gloss.value = data;
    loading.value = false;
  },
  { immediate: true }
);

async function toggleWord(word: string) {
  if (openWord.value === word) {
    openWord.value = '';
    return;
  }
  openWord.value = word;
  openWordText.value = '正在取詞義…';
  const senses = await loadWordGloss(word);
  if (openWord.value !== word) return;
  openWordText.value = senses?.[0]?.def || '萌典裡查不到這個詞的解釋。';
}
</script>

<template>
  <div v-if="gloss" class="card">
    <div class="card-title">
      <span>字義・組詞</span>
      <span v-if="bopomofoText" class="pill">{{ bopomofoText }}</span>
    </div>
    <p v-if="metaText" class="hint">{{ metaText }}</p>

    <ol v-if="gloss.senses.length" class="gloss-senses">
      <li v-for="(sense, i) in gloss.senses" :key="i">
        <span v-if="sense.type" class="gloss-type">{{ sense.type }}</span>
        <span>{{ sense.def }}</span>
        <span v-if="sense.examples.length" class="gloss-example">{{ sense.examples[0] }}</span>
      </li>
    </ol>

    <template v-if="words.length">
      <div class="tool-divider" />
      <p class="hint">組詞（點一下看詞義）</p>
      <div class="gloss-words">
        <button
          v-for="word in words"
          :key="word"
          class="gloss-word"
          :class="{ 'is-open': openWord === word }"
          type="button"
          @click="toggleWord(word)"
        >
          {{ word }}
        </button>
      </div>
      <p v-if="openWord" class="hint gloss-word-def">
        <strong>{{ openWord }}</strong
        >：{{ openWordText }}
      </p>
    </template>

    <template v-if="gloss.english.length">
      <div class="tool-divider" />
      <button class="btn btn-ghost btn-sm" type="button" @click="showEnglish = !showEnglish">
        {{ showEnglish ? '收起英文' : '英文釋義' }}
      </button>
      <p v-if="showEnglish" class="hint gloss-english">{{ gloss.english.join('；') }}</p>
    </template>

    <p class="hint gloss-source">
      資料來源：萌典 · 教育部重編國語辭典修訂本／兩岸詞典（CC BY-ND 3.0 TW）
    </p>
  </div>
  <p v-else-if="loading && char" class="card hint">正在取「{{ char }}」的字義…</p>
</template>
