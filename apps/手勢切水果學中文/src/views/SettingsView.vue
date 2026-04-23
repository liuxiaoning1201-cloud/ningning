<script setup lang="ts">
import * as XLSX from 'xlsx';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useLevelStore } from '@/stores/levels';
import { useWordPackStore } from '@/stores/wordPack';
import { defaultLevel, type DisplayMode, type GameMode, type Level, type VoicePolicy } from '@/types/level';
import type { LangRead, WordEntry } from '@/types/word';

const router = useRouter();
const route = useRoute();
const levelStore = useLevelStore();
const wordStore = useWordPackStore();
const { items: levels, selectedId } = storeToRefs(levelStore);
const { entries, allTags } = storeToRefs(wordStore);

type Tab = 'levels' | 'words';
const tab = ref<Tab>(route.query.tab === 'words' ? 'words' : 'levels');
const expanded = ref<Set<string>>(new Set());

/* ─── 關卡：簡化選項 ─── */
const modeOptions: { value: GameMode; label: string; hint: string }[] = [
  { value: 'timed', label: '限時', hint: '在時間內盡量多捏中' },
  { value: 'count', label: '定量', hint: '捏滿指定顆數即通關' },
  { value: 'survival', label: '生存', hint: '漏太多就結束' },
  { value: 'free', label: '自由', hint: '不結束，隨時停' },
];

const voiceOptions: { value: VoicePolicy; label: string }[] = [
  { value: 'mandarin', label: '普通話' },
  { value: 'cantonese', label: '粵語' },
  { value: 'per_entry', label: '依詞條' },
];

const displayOptions: { value: DisplayMode; label: string }[] = [
  { value: 'hanzi_pinyin', label: '漢字＋拼音' },
  { value: 'hanzi_only', label: '只看漢字' },
  { value: 'pinyin_only', label: '只看拼音' },
];

/** 把連續的干擾比例簡化成三段：無 / 少 / 多 */
const distractorPresets: { label: string; value: number }[] = [
  { label: '無', value: 0 },
  { label: '少', value: 0.3 },
  { label: '多', value: 0.5 },
];

function isExpanded(id: string) {
  return expanded.value.has(id);
}
function toggleExpand(id: string) {
  const s = new Set(expanded.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  expanded.value = s;
}

function poolSize(l: Level) {
  return wordStore.byTags(l.topics).length;
}
function distractorSize(l: Level) {
  return l.distractorRatio > 0 ? wordStore.notByTags(l.topics).length : 0;
}

function patch(l: Level, changes: Partial<Level>) {
  levelStore.patch(l.id, changes);
}

function toggleTopic(l: Level, tag: string) {
  const s = new Set(l.topics);
  if (s.has(tag)) s.delete(tag);
  else s.add(tag);
  patch(l, { topics: [...s] });
}

function newLevel() {
  const l = defaultLevel({ name: '新關卡', distractorRatio: 0.3 });
  levelStore.upsert(l);
  expanded.value = new Set([...expanded.value, l.id]);
}

function duplicateLevel(l: Level) {
  const copy = levelStore.duplicate(l.id);
  if (copy) expanded.value = new Set([...expanded.value, copy.id]);
}

function removeLevel(l: Level) {
  if (l.builtin) return;
  if (!confirm(`確定刪除「${l.name}」？`)) return;
  levelStore.remove(l.id);
}

function playLevel(l: Level) {
  levelStore.select(l.id);
  router.push(`/play?level=${encodeURIComponent(l.id)}`);
}

/* ─── 詞表匯入 ─── */
const pasteText = ref('');
const parseError = ref('');
const importStatus = ref('');

function normalizeLang(s: string): LangRead {
  const t = s.trim().toLowerCase();
  if (t.includes('粵') || t === 'yue' || t === 'cantonese' || t === 'hk') return 'cantonese';
  return 'mandarin';
}

function rowToEntry(cols: string[]): WordEntry | null {
  if (!cols.length || !cols[0]) return null;
  const word = cols[0]!;
  const hanzi = cols[1] || undefined;
  const pinyin = cols[2] || undefined;
  const langRead = normalizeLang(cols[3] || 'mandarin');
  const tags = (cols[4] || '')
    .split(/[;\/、，,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const diffNum = Number((cols[5] || '').trim());
  const difficulty =
    diffNum === 1 || diffNum === 2 || diffNum === 3 ? (diffNum as 1 | 2 | 3) : undefined;
  return {
    word: hanzi || word,
    hanzi: hanzi && hanzi !== word ? hanzi : undefined,
    pinyin,
    langRead,
    ...(tags.length ? { tags } : {}),
    ...(difficulty ? { difficulty } : {}),
  };
}

function parseLines(text: string): WordEntry[] {
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: WordEntry[] = [];
  for (const line of lines) {
    if (/^詞語|^词语|^汉字|^漢字|^拼音|^語言|^语言|^標籤|^标签|^難度|^难度/i.test(line) && line.length < 30) continue;
    const cols = line.split(/[\t,|]/).map((c) => c.trim());
    const e = rowToEntry(cols);
    if (e) out.push(e);
  }
  return out;
}

function applyPaste() {
  parseError.value = '';
  importStatus.value = '';
  try {
    const next = parseLines(pasteText.value);
    if (!next.length) {
      parseError.value = '沒有解析到有效列，請檢查格式。';
      return;
    }
    wordStore.setWords(next);
    pasteText.value = '';
    importStatus.value = `成功匯入 ${next.length} 筆詞條。`;
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : '解析失敗';
  }
}

function onFile(e: Event) {
  parseError.value = '';
  importStatus.value = '';
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = reader.result;
      if (!data) return;
      if (file.name.endsWith('.csv')) {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
        const next = parseLines(text);
        if (!next.length) {
          parseError.value = 'CSV 無有效資料';
          return;
        }
        wordStore.setWords(next);
        importStatus.value = `成功匯入 ${next.length} 筆詞條（CSV）。`;
        return;
      }
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, { header: 1 });
      const out: WordEntry[] = [];
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const cols = row.map((c) => (c === undefined || c === null ? '' : String(c)));
        if (/^詞語|^词语|^汉字|^漢字|^拼音|^語言|^语言|^標籤|^标签|^難度|^难度/i.test(cols[0] || '')) continue;
        const ent = rowToEntry(cols);
        if (ent) out.push(ent);
      }
      if (!out.length) {
        parseError.value = '試算表無有效資料';
        return;
      }
      wordStore.setWords(out);
      importStatus.value = `成功匯入 ${out.length} 筆詞條（Excel）。`;
    } catch (err) {
      parseError.value = err instanceof Error ? err.message : '讀取失敗';
    }
  };
  if (file.name.endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

const previewWords = computed(() => entries.value.slice(0, 10));

function voiceLabel(v: VoicePolicy) {
  return voiceOptions.find((x) => x.value === v)?.label || v;
}
function modeLabel(m: GameMode) {
  return modeOptions.find((x) => x.value === m)?.label || m;
}
</script>

<template>
  <div class="min-h-full bg-gradient-to-b from-[#fdf4ff] via-[#eef5ff] to-[#f1fff8] px-5 py-8 pb-24 text-[#3d2255]">
    <div class="mx-auto max-w-3xl">
      <div class="mb-5 flex items-center justify-between gap-3">
        <RouterLink to="/" class="inline-flex items-center gap-1.5 font-bold text-[#9b4dca] hover:underline">
          ← 回首頁
        </RouterLink>
        <div class="flex gap-2 text-xs font-semibold text-[#8a6fb0]">
          <span class="rounded-full bg-white/70 px-3 py-1 ring-1 ring-[#ead4f7]">
            目前詞庫 {{ entries.length }} 筆
          </span>
          <span v-if="allTags.length" class="rounded-full bg-white/70 px-3 py-1 ring-1 ring-[#ead4f7]">
            {{ allTags.length }} 種主題
          </span>
        </div>
      </div>

      <h1 class="mb-1 text-3xl font-black text-[#6b2f8f]">教師設定</h1>
      <p class="mb-5 text-sm font-medium text-[#5c406e]">
        幫每一關設一個<strong>主題目標</strong>（例：人物、前鼻音），再加一點<strong>干擾詞</strong>讓學生學會辨識。
      </p>

      <!-- 分頁 -->
      <div class="mb-6 inline-flex rounded-2xl bg-white/80 p-1 shadow ring-1 ring-[#ead4f7]">
        <button
          type="button"
          class="rounded-xl px-5 py-2 text-sm font-black transition"
          :class="tab === 'levels' ? 'bg-gradient-to-r from-[#c77dff] to-[#ff6bcb] text-white shadow' : 'text-[#6b2f8f] hover:bg-[#faf2ff]'"
          @click="tab = 'levels'"
        >
          🎯 關卡（{{ levels.length }}）
        </button>
        <button
          type="button"
          class="rounded-xl px-5 py-2 text-sm font-black transition"
          :class="tab === 'words' ? 'bg-gradient-to-r from-[#c77dff] to-[#ff6bcb] text-white shadow' : 'text-[#6b2f8f] hover:bg-[#faf2ff]'"
          @click="tab = 'words'"
        >
          📖 詞表匯入
        </button>
      </div>

      <!-- ───────── 關卡分頁 ───────── -->
      <section v-show="tab === 'levels'">
        <div class="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-2xl bg-gradient-to-r from-[#c77dff] to-[#ff6bcb] px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:brightness-110"
            @click="newLevel"
          >
            ＋ 新建關卡
          </button>
          <button
            type="button"
            class="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-[#8e3db8] shadow ring-1 ring-[#e6d0f5] hover:bg-[#fdf5ff]"
            @click="levelStore.resetBuiltins()"
          >
            還原內建關卡
          </button>
        </div>

        <div class="space-y-3">
          <article
            v-for="l in levels"
            :key="l.id"
            class="rounded-3xl bg-white/95 shadow-md ring-2 transition"
            :class="l.id === selectedId ? 'ring-[#d56fff]' : 'ring-[#ece6fa]'"
          >
            <!-- 標題列 -->
            <header class="flex flex-wrap items-center gap-3 p-4">
              <input
                type="text"
                :value="l.name"
                class="min-w-0 flex-1 rounded-xl border-2 border-transparent bg-transparent px-2 py-1 text-lg font-black text-[#3b1c4f] outline-none focus:border-[#e8c7ff] focus:bg-white"
                @change="(e) => patch(l, { name: (e.target as HTMLInputElement).value.trim() || '未命名' })"
              />
              <span v-if="l.builtin" class="rounded-full bg-[#ffefb8] px-2 py-0.5 text-[10px] font-black text-[#8a5a00]">內建</span>

              <button
                type="button"
                class="rounded-xl bg-gradient-to-r from-[#39d98a] to-[#26c6da] px-4 py-2 text-sm font-black text-white shadow hover:brightness-110"
                @click="playLevel(l)"
              >
                ▶ 試玩
              </button>
              <button
                type="button"
                class="rounded-xl bg-[#f1e6ff] px-3 py-2 text-sm font-bold text-[#6a2fb0] hover:bg-[#e6d2ff]"
                :aria-expanded="isExpanded(l.id)"
                @click="toggleExpand(l.id)"
              >
                {{ isExpanded(l.id) ? '收起 ▴' : '設定 ▾' }}
              </button>
            </header>

            <!-- 摘要列 -->
            <div class="flex flex-wrap items-center gap-2 px-4 pb-3 text-xs font-semibold">
              <span class="rounded-full bg-[#fde8ff] px-2 py-0.5 text-[#a1299b]">
                {{ l.topics.length ? l.topics.map((t) => '#' + t).join(' ') : '#全部詞' }}
              </span>
              <span class="rounded-full bg-[#e8ffe3] px-2 py-0.5 text-[#2e7d32]">
                {{ modeLabel(l.mode) }}{{
                  l.mode === 'timed' ? ` ${l.duration}s`
                  : l.mode === 'count' ? ` ${l.targetCount}顆`
                  : l.mode === 'survival' ? ` 可漏${l.missAllowance}`
                  : ''
                }}
              </span>
              <span class="rounded-full bg-[#e0f2ff] px-2 py-0.5 text-[#2f6f9c]">{{ voiceLabel(l.voice) }}</span>
              <span class="rounded-full bg-[#fff4cf] px-2 py-0.5 text-[#8a5a00]">
                目標池 {{ poolSize(l) }} 詞
                <span v-if="l.distractorRatio > 0"> · 干擾 {{ distractorSize(l) }}</span>
              </span>
            </div>

            <!-- 展開編輯區 -->
            <div v-if="isExpanded(l.id)" class="border-t border-[#f0e4fa] p-4">
              <!-- 主題 -->
              <div class="mb-5">
                <div class="mb-2 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-black uppercase tracking-wide text-[#a347c9]">🎯 目標詞主題</div>
                    <div class="text-[11px] text-[#5a4166]">點選要納入的主題；不選則使用全部詞。</div>
                  </div>
                </div>
                <div v-if="allTags.length" class="flex flex-wrap gap-1.5">
                  <button
                    v-for="t in allTags"
                    :key="t"
                    type="button"
                    class="rounded-full px-3 py-1 text-xs font-bold transition"
                    :class="l.topics.includes(t) ? 'bg-[#d56fff] text-white shadow' : 'bg-[#f3e8ff] text-[#6a2fb0] hover:bg-[#e8d4ff]'"
                    @click="toggleTopic(l, t)"
                  >
                    #{{ t }}
                    <span class="ml-1 text-[10px] opacity-80">{{ wordStore.tagCount(t) }}</span>
                  </button>
                </div>
                <p v-else class="rounded-xl bg-[#fff4cf] px-3 py-2 text-xs text-[#7a5a15]">
                  尚無標籤。請到「📖 詞表匯入」頁加入含<strong>標籤</strong>欄位的詞條。
                </p>
              </div>

              <!-- 玩法 -->
              <div class="mb-5">
                <div class="mb-2 text-xs font-black uppercase tracking-wide text-[#a347c9]">🎮 玩法</div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="m in modeOptions"
                    :key="m.value"
                    type="button"
                    class="rounded-2xl px-3 py-1.5 text-xs font-bold transition"
                    :class="l.mode === m.value ? 'bg-[#4a235f] text-white shadow' : 'bg-[#f3e8ff] text-[#4a235f] hover:bg-[#e8d4ff]'"
                    :title="m.hint"
                    @click="patch(l, { mode: m.value })"
                  >
                    {{ m.label }}
                  </button>
                </div>
                <div class="mt-3 flex flex-wrap gap-3">
                  <label v-if="l.mode === 'timed'" class="text-xs font-semibold text-[#4a235f]">
                    時長
                    <input
                      type="number" min="15" max="300"
                      :value="l.duration ?? 60"
                      class="ml-1 w-20 rounded-lg border-2 border-[#e8c7ff] bg-white px-2 py-1 font-bold outline-none focus:border-[#d56fff]"
                      @change="(e) => patch(l, { duration: Number((e.target as HTMLInputElement).value) || 60 })"
                    /> 秒
                  </label>
                  <label v-if="l.mode === 'count'" class="text-xs font-semibold text-[#4a235f]">
                    目標數
                    <input
                      type="number" min="1" max="60"
                      :value="l.targetCount ?? 15"
                      class="ml-1 w-20 rounded-lg border-2 border-[#e8c7ff] bg-white px-2 py-1 font-bold outline-none focus:border-[#d56fff]"
                      @change="(e) => patch(l, { targetCount: Number((e.target as HTMLInputElement).value) || 15 })"
                    /> 顆
                  </label>
                  <label v-if="l.mode === 'survival'" class="text-xs font-semibold text-[#4a235f]">
                    可漏
                    <input
                      type="number" min="1" max="20"
                      :value="l.missAllowance ?? 3"
                      class="ml-1 w-20 rounded-lg border-2 border-[#e8c7ff] bg-white px-2 py-1 font-bold outline-none focus:border-[#d56fff]"
                      @change="(e) => patch(l, { missAllowance: Number((e.target as HTMLInputElement).value) || 3 })"
                    /> 次
                  </label>
                </div>
              </div>

              <!-- 干擾詞 -->
              <div class="mb-5">
                <div class="mb-2 text-xs font-black uppercase tracking-wide text-[#a347c9]">🚫 干擾詞</div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="d in distractorPresets"
                    :key="d.label"
                    type="button"
                    class="rounded-2xl px-3 py-1.5 text-xs font-bold transition"
                    :class="Math.abs(l.distractorRatio - d.value) < 0.02 ? 'bg-[#ff6bcb] text-white shadow' : 'bg-[#fde8ff] text-[#a1299b] hover:bg-[#fcd4f1]'"
                    @click="patch(l, { distractorRatio: d.value })"
                  >
                    {{ d.label }}
                    <span v-if="d.value > 0" class="ml-1 opacity-80">{{ Math.round(d.value * 100) }}%</span>
                  </button>
                </div>
                <p class="mt-1 text-[11px] text-[#5a4166]">干擾詞會自動從非目標主題中抽；捏到會扣分。</p>
              </div>

              <!-- 發音 -->
              <div class="mb-5">
                <div class="mb-2 text-xs font-black uppercase tracking-wide text-[#a347c9]">🔊 發音</div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="v in voiceOptions"
                    :key="v.value"
                    type="button"
                    class="rounded-2xl px-3 py-1.5 text-xs font-bold transition"
                    :class="l.voice === v.value ? 'bg-[#2f6f9c] text-white shadow' : 'bg-[#e0f2ff] text-[#2f6f9c] hover:bg-[#cfe8fc]'"
                    @click="patch(l, { voice: v.value })"
                  >
                    {{ v.label }}
                  </button>
                </div>
              </div>

              <!-- 進階 -->
              <details class="mb-3 rounded-2xl bg-[#faf2ff] px-4 py-3">
                <summary class="cursor-pointer text-xs font-black text-[#6a2fb0]">進階選項</summary>
                <div class="mt-3 space-y-3 text-xs">
                  <label class="flex items-center gap-3">
                    <span class="w-20 font-bold text-[#4a235f]">顯示方式</span>
                    <select
                      :value="l.display"
                      class="flex-1 rounded-lg border-2 border-[#e8c7ff] bg-white px-2 py-1 font-bold outline-none focus:border-[#d56fff]"
                      @change="(e) => patch(l, { display: (e.target as HTMLSelectElement).value as DisplayMode })"
                    >
                      <option v-for="d in displayOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
                    </select>
                  </label>
                  <label class="flex items-center gap-3">
                    <span class="w-20 font-bold text-[#4a235f]">下落速度</span>
                    <input
                      type="range" min="0.6" max="1.6" step="0.1"
                      :value="l.speedScale"
                      class="flex-1 accent-[#c77dff]"
                      @input="(e) => patch(l, { speedScale: Number((e.target as HTMLInputElement).value) })"
                    />
                    <span class="w-10 text-right font-black text-[#4a235f]">×{{ l.speedScale.toFixed(1) }}</span>
                  </label>
                  <label class="flex items-center gap-2 font-semibold text-[#4a235f]">
                    <input
                      type="checkbox" class="accent-[#c77dff]"
                      :checked="l.wrongPenalty"
                      @change="(e) => patch(l, { wrongPenalty: (e.target as HTMLInputElement).checked })"
                    />
                    錯捏干擾詞扣分
                  </label>
                  <label class="flex items-center gap-2 font-semibold text-[#4a235f]">
                    <input
                      type="checkbox" class="accent-[#c77dff]"
                      :checked="l.missPenalty"
                      @change="(e) => patch(l, { missPenalty: (e.target as HTMLInputElement).checked })"
                    />
                    漏接目標詞扣分
                  </label>
                  <label class="flex items-center gap-2 font-semibold text-[#4a235f]">
                    <input
                      type="checkbox" class="accent-[#c77dff]"
                      :checked="l.allowRepeat"
                      @change="(e) => patch(l, { allowRepeat: (e.target as HTMLInputElement).checked })"
                    />
                    允許同詞重複
                  </label>
                </div>
              </details>

              <!-- 刪除／複製 -->
              <div class="flex flex-wrap gap-2 text-xs">
                <button type="button" class="rounded-lg bg-white px-3 py-1.5 font-bold text-[#6a2fb0] ring-1 ring-[#e6d0f5] hover:bg-[#faf2ff]" @click="duplicateLevel(l)">
                  複製
                </button>
                <button
                  v-if="!l.builtin"
                  type="button"
                  class="rounded-lg bg-white px-3 py-1.5 font-bold text-[#c72c5b] ring-1 ring-[#ffd7e0] hover:bg-[#fff3f6]"
                  @click="removeLevel(l)"
                >
                  刪除
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-[#f1e6ff] px-3 py-1.5 font-bold text-[#6a2fb0]"
                  @click="levelStore.select(l.id)"
                >
                  設為首頁預設
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- ───────── 詞表分頁 ───────── -->
      <section v-show="tab === 'words'" class="space-y-5">
        <div class="rounded-3xl bg-white/95 p-5 shadow-md ring-2 ring-[#ece6fa]">
          <h2 class="mb-2 text-lg font-black text-[#6b2f8f]">上傳詞表</h2>
          <p class="mb-3 text-sm text-[#5c406e]">
            支援 <strong>.xlsx / .csv</strong>；或用文字框貼上以 Tab、逗號、<code>|</code> 分隔的內容。欄位：
            <strong>①詞語 ②漢字 ③拼音 ④語言 ⑤標籤 ⑥難度</strong>（後 5 欄選填）。
          </p>

          <div class="mb-3 overflow-x-auto rounded-xl bg-[#faf2ff] p-2 text-xs">
            <table class="min-w-full font-semibold">
              <thead class="text-[#8a3fbf]">
                <tr><th class="px-2 py-1 text-left">詞語</th><th class="px-2 py-1 text-left">漢字</th><th class="px-2 py-1 text-left">拼音</th><th class="px-2 py-1 text-left">語言</th><th class="px-2 py-1 text-left">標籤</th><th class="px-2 py-1 text-left">難度</th></tr>
              </thead>
              <tbody class="text-[#3d2255]">
                <tr><td class="px-2 py-1">春天</td><td class="px-2 py-1">春</td><td class="px-2 py-1">chūntiān</td><td class="px-2 py-1">普通话</td><td class="px-2 py-1">前鼻音;季節</td><td class="px-2 py-1">1</td></tr>
                <tr><td class="px-2 py-1">朋友</td><td class="px-2 py-1"></td><td class="px-2 py-1">péngyou</td><td class="px-2 py-1">粤语</td><td class="px-2 py-1">人物</td><td class="px-2 py-1">1</td></tr>
              </tbody>
            </table>
            <p class="mt-1 px-2 text-[11px] text-[#5a4166]">
              標籤可多個，用 <code>;</code> <code>/</code> <code>、</code> <code>,</code> 分隔；難度 1–3；語言填「普通话 / 粤语」。
            </p>
          </div>

          <textarea
            v-model="pasteText"
            rows="6"
            class="mb-3 w-full resize-y rounded-2xl border-2 border-[#e8c7ff] bg-[#fffafd] p-3 font-mono text-sm leading-relaxed text-[#402050] outline-none focus:border-[#d56fff]"
            placeholder="春天	春	chūntiān	普通话	前鼻音;季節	1
朋友		péngyou	粤语	人物	1"
          />

          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-2xl bg-gradient-to-r from-[#c77dff] to-[#ff6bcb] px-5 py-2.5 text-sm font-black text-white shadow hover:brightness-110" @click="applyPaste">
              匯入貼上內容
            </button>
            <label class="cursor-pointer rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-[#8e3db8] shadow ring-2 ring-[#c77dff] hover:bg-[#fdf5ff]">
              選擇 Excel / CSV
              <input type="file" accept=".xlsx,.xls,.csv,text/csv" class="hidden" @change="onFile" />
            </label>
            <button type="button" class="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-[#9960a8] shadow ring-1 ring-[#e6d0f5]" @click="wordStore.resetDemo(); importStatus = '已還原示範詞表'">
              還原示範詞表
            </button>
          </div>
          <p v-if="parseError" class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ parseError }}</p>
          <p v-if="importStatus" class="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{{ importStatus }}</p>
        </div>

        <div class="rounded-3xl bg-white/95 p-5 shadow-md ring-2 ring-[#ece6fa]">
          <h2 class="mb-3 text-lg font-black text-[#6b2f8f]">詞表預覽（前 10 筆）</h2>
          <ul class="space-y-2 text-sm font-semibold">
            <li v-for="(w, i) in previewWords" :key="i" class="flex flex-wrap items-center gap-2 rounded-xl bg-[#faf2ff] px-3 py-2">
              <span class="text-base text-[#3b1c4f]">{{ w.word }}</span>
              <span v-if="w.pinyin" class="text-[#6e558a]">{{ w.pinyin }}</span>
              <span class="rounded-full bg-[#ffe8fb] px-2 py-0.5 text-[10px] font-black text-[#c226a8]">
                {{ w.langRead === 'cantonese' ? '粵' : '普' }}
              </span>
              <span v-for="t in w.tags || []" :key="t" class="rounded-full bg-[#fff4cf] px-2 py-0.5 text-[10px] font-bold text-[#8a5a00]">#{{ t }}</span>
              <span v-if="w.difficulty" class="rounded-full bg-[#e0f2ff] px-2 py-0.5 text-[10px] font-bold text-[#2f6f9c]">難度{{ w.difficulty }}</span>
            </li>
          </ul>
          <p class="mt-3 text-xs font-medium text-[#607d8b]">
            目前共 {{ entries.length }} 筆詞條 · 已自動儲存在本機瀏覽器。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
