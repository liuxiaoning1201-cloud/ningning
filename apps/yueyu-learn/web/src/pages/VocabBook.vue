<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useVocabStore } from '@/stores/vocab'
import { useTts } from '@/composables/useTts'
import { isDue } from '@yueyu/shared/srs'

const vocab = useVocabStore()
const tts = useTts()

const filter = ref<'all' | 'due' | 'mastered'>('all')
const search = ref('')

onMounted(() => {
  if (!vocab.loaded) vocab.load()
})

const filtered = computed(() => {
  let list = vocab.entries
  if (filter.value === 'due') list = list.filter((e) => isDue(e.srs))
  else if (filter.value === 'mastered') list = list.filter((e) => (e.srs?.repetitions ?? 0) >= 4)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(
      (e) =>
        e.written.toLowerCase().includes(q) ||
        e.cantonese.toLowerCase().includes(q) ||
        (e.jyutping ?? '').toLowerCase().includes(q),
    )
  }
  return list
})

async function onDelete(id: string) {
  if (!confirm('確定要刪除這條生詞嗎？')) return
  await vocab.remove(id)
}

function play(text: string) {
  tts.speak(text)
}
</script>

<template>
  <div class="space-y-5 pb-24 md:pb-0">
    <header class="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-2xl font-bold mb-1">📓 生詞本</h2>
        <p class="text-sm" style="color: var(--color-muted)">
          共 <strong style="color: var(--color-ink)">{{ vocab.total }}</strong> 條
          ·
          待複習 <strong style="color: var(--color-accent)">{{ vocab.entries.filter(e => isDue(e.srs)).length }}</strong>
          <span v-if="!vocab.cloudAvailable" class="ml-2 text-xs" style="color: var(--color-muted)">（離線模式 · 未登入）</span>
        </p>
      </div>
      <div class="flex gap-1 text-sm">
        <button
          v-for="opt in [{ id: 'all', label: '全部' }, { id: 'due', label: '待複習' }, { id: 'mastered', label: '已掌握' }] as const"
          :key="opt.id"
          class="px-3 py-1.5 rounded-lg cursor-pointer transition"
          :style="filter === opt.id
            ? { background: 'var(--color-ink)', color: 'var(--color-paper)' }
            : { background: 'color-mix(in srgb, var(--color-ink) 6%, transparent)' }"
          @click="filter = opt.id"
        >
          {{ opt.label }}
        </button>
      </div>
    </header>

    <input
      v-model="search"
      type="search"
      placeholder="🔎 搜尋書面語、粵語、粵拼…"
      class="card w-full px-4 py-2.5 text-sm outline-none"
      style="background: white"
    />

    <div v-if="filtered.length === 0 && vocab.loaded" class="card p-8 text-center">
      <div class="text-5xl mb-3">📭</div>
      <div class="font-medium mb-1">{{ filter === 'all' ? '生詞本還是空的' : '無符合條件的生詞' }}</div>
      <p class="text-sm" style="color: var(--color-muted)">
        在「粘貼翻譯」頁點擊 ☆ 收藏 即可加入這裡。
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="entry in filtered"
        :key="entry.id"
        class="card p-4 group"
      >
        <div class="flex items-start gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-xs mb-1 flex items-center gap-2" style="color: var(--color-muted)">
              <span>📖 {{ entry.written }}</span>
              <span v-if="entry.source?.title" class="opacity-60">· {{ entry.source.title }}</span>
            </div>
            <div class="text-base md:text-lg font-medium token-yue inline-block">{{ entry.cantonese }}</div>
            <div v-if="entry.jyutping" class="text-xs font-mono mt-1" style="color: var(--color-muted)">
              {{ entry.jyutping }}
            </div>
            <div v-if="entry.explanation" class="text-xs italic mt-1" style="color: var(--color-muted)">
              💡 {{ entry.explanation }}
            </div>
            <div class="text-xs mt-2 flex gap-3" style="color: var(--color-muted)">
              <span>🗓️ {{ new Date(entry.createdAt).toLocaleDateString('zh-HK') }}</span>
              <span v-if="entry.srs">
                複習 {{ entry.srs.repetitions }} 次
                · 下次 {{ new Date(entry.srs.dueAt).toLocaleDateString('zh-HK') }}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition">
            <button
              class="text-xs px-2.5 py-1 rounded cursor-pointer hover:bg-black/5"
              style="color: var(--color-jade)"
              @click="play(entry.cantonese)"
            >🔊 朗讀</button>
            <button
              class="text-xs px-2.5 py-1 rounded cursor-pointer hover:bg-black/5"
              style="color: var(--color-accent)"
              @click="onDelete(entry.id)"
            >🗑️ 刪除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
