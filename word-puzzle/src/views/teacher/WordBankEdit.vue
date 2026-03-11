<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/teacher" class="btn btn-secondary">← 詞句庫列表</RouterLink>
    </nav>
    <h1 class="page-title">{{ isNew ? "新增詞句庫" : "編輯詞句庫" }}</h1>
    <div class="card" style="margin-bottom: 1rem">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500">詞句庫名稱</label>
      <input v-model="bankName" type="text" placeholder="例如：五年級論語" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius)" />
    </div>
    <div class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">匯入詞句</h2>
      <p class="muted" style="margin-bottom: 0.5rem">上傳 .xlsx 或 .csv，第一欄為詞句、第二欄釋義（可選）、第三欄出處（可選）、第四欄難度 1–5（可選）。</p>
      <label class="btn btn-primary" style="cursor: pointer">
        選擇檔案
        <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" style="display: none" @change="onFileChange" />
      </label>
    </div>
    <div class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">當前詞條 <span class="count-badge">{{ items.length }}</span></h2>
      <table v-if="items.length > 0" class="word-table">
        <thead>
          <tr><th>詞句</th><th>釋義</th><th>出處</th><th>難度</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(it, i) in items" :key="it.id">
            <td><input v-model="it.text" type="text" class="cell-input" /></td>
            <td><input v-model="it.definition" type="text" class="cell-input" /></td>
            <td><input v-model="it.source" type="text" class="cell-input" placeholder="如《為政》" /></td>
            <td><input v-model.number="it.difficulty" type="number" min="1" max="5" class="cell-input num" /></td>
            <td><button type="button" class="btn-link danger" @click="removeItem(i)">刪除</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">尚無詞條，請用上方匯入或手動新增。</p>
      <button type="button" class="btn btn-secondary" style="margin-top: 0.5rem" @click="addItem">新增一筆</button>
    </div>
    <div style="display: flex; gap: 0.5rem">
      <button type="button" class="btn btn-primary" @click="save">儲存詞句庫</button>
      <RouterLink to="/teacher" class="btn btn-secondary">取消</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWordBanksStore } from "@/stores/wordBanks";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import type { WordBank, WordBankItem } from "@/lib/types";
import { parseExcelOrCsv } from "@/lib/importExcel";

const route = useRoute();
const router = useRouter();
const wordBanks = useWordBanksStore();

const fileInput = ref<HTMLInputElement | null>(null);
const bankName = ref("");
const items = ref<WordBankItem[]>([]);

const bankId = computed(() => route.params.bankId as string);
const isNew = computed(() => bankId.value === "new" || !bankId.value);

onMounted(() => {
  if (!isNew.value && bankId.value) {
    const bank = wordBanks.banks.find((b) => b.id === bankId.value);
    if (bank) {
      bankName.value = bank.name;
      items.value = bank.items.map((it) => ({ ...it }));
    }
  }
});

function addItem() {
  items.value.push({
    id: generateId(),
    text: "",
    definition: "",
    source: "",
    difficulty: 1,
  });
}

function removeItem(i: number) {
  items.value.splice(i, 1);
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const parsed = await parseExcelOrCsv(file);
  if (parsed.length > 0) {
    const newItems = parsed.map((row) => ({
      id: generateId(),
      text: row.text,
      definition: row.definition ?? "",
      source: row.source ?? "",
      difficulty: Math.min(5, Math.max(1, row.difficulty ?? 1)),
    }));
    items.value = [...items.value, ...newItems];
    alert(`已匯入 ${newItems.length} 筆詞條。`);
  }
  input.value = "";
}

function save() {
  const name = bankName.value.trim();
  if (!name) {
    alert("請輸入詞句庫名稱");
    return;
  }
  const bank: WordBank = {
    id: isNew.value ? generateId() : bankId.value,
    name,
    items: items.value.filter((it) => it.text.trim()),
    createdAt: new Date().toISOString(),
  };
  if (isNew.value) {
    wordBanks.addBank(bank);
  } else {
    wordBanks.updateBank(bank);
  }
  router.push("/teacher");
}
</script>

<style scoped>
.muted { color: var(--text-muted); font-size: 0.9rem; }
.count-badge { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 999px; font-size: 12px; margin-left: 6px; }
.word-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.word-table th, .word-table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--border); }
.word-table th { color: var(--text-muted); font-weight: 500; }
.cell-input { width: 100%; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; }
.cell-input.num { width: 3rem; }
.btn-link { background: none; border: none; cursor: pointer; color: var(--primary); padding: 0; }
.btn-link.danger { color: #dc2626; }
</style>
