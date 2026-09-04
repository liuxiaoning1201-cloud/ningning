<script setup lang="ts">
import * as XLSX from 'xlsx';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useWordPackStore } from '@/stores/wordPack';
import type { LangRead, WordEntry } from '@/types/word';

const router = useRouter();
const store = useWordPackStore();
const { entries } = storeToRefs(store);

const pasteText = ref('');
const parseError = ref('');
const preview = computed(() => entries.value.slice(0, 8));

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
  const langRaw = cols[3] || 'mandarin';
  const langRead = normalizeLang(langRaw || 'mandarin');
  const tagsRaw = cols[4] || '';
  const tags = tagsRaw
    .split(/[;\/、，,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const diffRaw = (cols[5] || '').trim();
  const diffNum = Number(diffRaw);
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
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
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
  try {
    const next = parseLines(pasteText.value);
    if (!next.length) {
      parseError.value = '沒有解析到有效列，請檢查格式。';
      return;
    }
    store.setWords(next);
    pasteText.value = '';
  } catch (e) {
    parseError.value = e instanceof Error ? e.message : '解析失敗';
  }
}

function onFile(e: Event) {
  parseError.value = '';
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
        store.setWords(next);
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
        const e = rowToEntry(cols);
        if (e) out.push(e);
      }
      if (!out.length) {
        parseError.value = '試算表無有效資料（需要至少：詞語 欄）';
        return;
      }
      store.setWords(out);
    } catch (err) {
      parseError.value = err instanceof Error ? err.message : '讀取失敗';
    }
  };
  if (file.name.endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function done() {
  router.push('/');
}
</script>

<template>
  <div class="min-h-full bg-gradient-to-b from-[#fef3ff] to-[#d8f7ff] px-5 py-10 pb-24 text-[#3d2255]">
    <div class="mx-auto max-w-2xl">
      <RouterLink to="/" class="mb-6 inline-flex items-center gap-2 font-bold text-[#9b4dca] hover:underline">
        ← 回首頁
      </RouterLink>

      <h1 class="mb-2 text-3xl font-black text-[#6b2f8f]">教師：詞表匯入</h1>
      <p class="mb-4 text-base font-medium leading-relaxed text-[#5c406e]">
        支援 <strong>.xlsx / .csv</strong>，或用下方文字框貼上（<strong>Tab、逗號、|</strong> 分隔）。欄位順序：
      </p>
      <div class="mb-6 overflow-x-auto rounded-2xl bg-white/80 p-4 text-sm shadow ring-1 ring-[#ead4f7]">
        <table class="min-w-full border-separate border-spacing-y-1 font-semibold">
          <thead>
            <tr class="text-left text-[#8a3fbf]">
              <th class="px-2">①詞語</th>
              <th class="px-2">②漢字 <span class="font-normal text-[#8a6fb0]">選填</span></th>
              <th class="px-2">③拼音 <span class="font-normal text-[#8a6fb0]">選填</span></th>
              <th class="px-2">④語言</th>
              <th class="px-2">⑤標籤 <span class="font-normal text-[#8a6fb0]">選填</span></th>
              <th class="px-2">⑥難度 <span class="font-normal text-[#8a6fb0]">選填</span></th>
            </tr>
          </thead>
          <tbody class="text-[#3d2255]">
            <tr class="bg-[#faf2ff]">
              <td class="px-2 py-1">春天</td>
              <td class="px-2 py-1">春</td>
              <td class="px-2 py-1">chūntiān</td>
              <td class="px-2 py-1">普通话</td>
              <td class="px-2 py-1">前鼻音;季節</td>
              <td class="px-2 py-1">1</td>
            </tr>
            <tr class="bg-[#faf2ff]">
              <td class="px-2 py-1">朋友</td>
              <td class="px-2 py-1"></td>
              <td class="px-2 py-1">péngyou</td>
              <td class="px-2 py-1">粤语</td>
              <td class="px-2 py-1">人物</td>
              <td class="px-2 py-1">1</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-3 text-xs text-[#5a4166]">
          <strong>標籤</strong>可填多個，用 <code>;</code> <code>/</code> <code>、</code> <code>,</code> 分隔；<strong>難度</strong> 1–3。
          <strong>語言</strong>填「普通话 / 粤语」或 mandarin / cantonese。
        </p>
      </div>

      <div class="mb-8 rounded-3xl bg-white/90 p-6 shadow-xl ring-2 ring-[#f3c9ff]">
        <label class="mb-3 block text-sm font-black uppercase tracking-wide text-[#a347c9]">貼上試算表內容</label>
        <textarea
          v-model="pasteText"
          rows="8"
          class="mb-4 w-full resize-y rounded-2xl border-2 border-[#e8c7ff] bg-[#fffafd] p-4 font-mono text-sm leading-relaxed text-[#402050] outline-none focus:border-[#d56fff]"
          placeholder="春天	春	chūntiān	普通话	前鼻音;季節	1
朋友		péngyou	粤语	人物	1"
        />
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-2xl bg-gradient-to-r from-[#c77dff] to-[#ff6bcb] px-6 py-3 font-black text-white shadow-md transition hover:brightness-110"
            @click="applyPaste"
          >
            匯入貼上內容
          </button>
          <label
            class="cursor-pointer rounded-2xl border-2 border-[#c77dff] bg-white px-6 py-3 font-bold text-[#8e3db8] shadow-sm hover:bg-[#fdf5ff]"
          >
            選擇 Excel / CSV
            <input type="file" accept=".xlsx,.xls,.csv,text/csv" class="hidden" @change="onFile" />
          </label>
          <button
            type="button"
            class="rounded-2xl bg-white px-5 py-3 font-bold text-[#9960a8] shadow-sm ring-1 ring-[#e6d0f5]"
            @click="store.resetDemo()"
          >
            還原示範詞表
          </button>
        </div>
        <p v-if="parseError" class="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {{ parseError }}
        </p>
      </div>

      <div class="mb-10 rounded-3xl bg-white/85 p-6 shadow-lg ring-2 ring-[#c9f0ff]">
        <h2 class="mb-4 text-xl font-black text-[#2f6f9c]">預覽（前 8 筆）</h2>
        <ul class="space-y-2 font-semibold">
          <li v-for="(w, i) in preview" :key="i" class="flex flex-wrap items-center gap-2 rounded-xl bg-[#f5fbff] px-4 py-3">
            <span class="text-lg text-[#153047]">{{ w.word }}</span>
            <span v-if="w.pinyin" class="text-[#5a7d92]">{{ w.pinyin }}</span>
            <span class="rounded-full bg-[#ffe8fb] px-3 py-0.5 text-xs font-black text-[#c226a8]">
              {{ w.langRead === 'cantonese' ? '粵語' : '普通話' }}
            </span>
            <span v-for="t in w.tags || []" :key="t" class="rounded-full bg-[#fff4cf] px-2 py-0.5 text-[11px] font-bold text-[#8a5a00]">
              #{{ t }}
            </span>
            <span v-if="w.difficulty" class="rounded-full bg-[#e0f2ff] px-2 py-0.5 text-[11px] font-bold text-[#2f6f9c]">
              難度 {{ w.difficulty }}
            </span>
          </li>
        </ul>
        <p class="mt-4 text-sm font-medium text-[#607d8b]">目前共 {{ entries.length }} 筆詞條 · 已自動儲存在本機瀏覽器</p>
      </div>

      <button
        type="button"
        class="w-full rounded-3xl bg-[#39d98a] py-5 text-xl font-black text-white shadow-xl ring-4 ring-[#b8f5d9] transition hover:brightness-105"
        @click="done"
      >
        完成，返回首頁
      </button>
    </div>
  </div>
</template>
