<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '@/composables/useApi'
import type { ApiKeyRecord, ApiKeyCreateResponse } from '@yueyu/shared/api-client'
import { ApiError } from '@yueyu/shared/api-client'

const api = useApi()
const keys = ref<ApiKeyRecord[]>([])
const loading = ref(false)
const errorMsg = ref('')

const newName = ref('')
const newScopes = ref<string[]>(['translate', 'tts', 'ocr', 'vocab'])
const newExpiresInDays = ref<number | ''>('')
const creating = ref(false)
const created = ref<ApiKeyCreateResponse | null>(null)

const SCOPE_LABELS: Record<string, string> = {
  translate: '粵語翻譯',
  tts: '語音朗讀',
  ocr: '截圖識別',
  vocab: '生詞本',
}

async function refresh() {
  loading.value = true
  errorMsg.value = ''
  try {
    const r = await api.listApiKeys()
    keys.value = r.keys
  } catch (err) {
    if (err instanceof ApiError && err.needsLogin) {
      errorMsg.value = '請先登入 zykongjian.com 才能管理 API Key'
    } else {
      errorMsg.value = (err as Error).message || '載入失敗'
    }
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!newName.value.trim()) {
    errorMsg.value = '請填寫名稱'
    return
  }
  creating.value = true
  errorMsg.value = ''
  try {
    const payload: Parameters<typeof api.createApiKey>[0] = {
      name: newName.value.trim(),
      scopes: [...newScopes.value],
    }
    if (newExpiresInDays.value && Number(newExpiresInDays.value) > 0) {
      payload.expiresInDays = Number(newExpiresInDays.value)
    }
    const r = await api.createApiKey(payload)
    created.value = r
    newName.value = ''
    newExpiresInDays.value = ''
    await refresh()
  } catch (err) {
    if (err instanceof ApiError) {
      errorMsg.value = err.message
    } else {
      errorMsg.value = (err as Error).message || '創建失敗'
    }
  } finally {
    creating.value = false
  }
}

async function revoke(id: string) {
  if (!confirm('撤銷後此 Key 立即失效，依此 Key 的所有應用都會無法使用。確認嗎？')) return
  try {
    await api.revokeApiKey(id)
    await refresh()
  } catch (err) {
    errorMsg.value = (err as Error).message || '撤銷失敗'
  }
}

function copyToken(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isExpired(k: ApiKeyRecord): boolean {
  if (!k.expires_at) return false
  return Date.parse(k.expires_at.replace(' ', 'T') + 'Z') < Date.now()
}

onMounted(refresh)
</script>

<template>
  <div class="space-y-5 pb-24 md:pb-0">
    <header>
      <h2 class="text-2xl font-bold mb-1">🔑 個人 API Keys</h2>
      <p class="text-sm" style="color: var(--color-muted)">
        為其他軟件（命令列腳本、自寫的 APP、第三方插件）申請一把長期 Token，
        所有調用都計入您的個人配額。
      </p>
    </header>

    <!-- 剛剛創建的 Key（一次性顯示） -->
    <section
      v-if="created"
      class="card p-5 space-y-3"
      style="background: linear-gradient(120deg, color-mix(in srgb, var(--color-jade) 12%, white), white)"
    >
      <div class="flex items-center gap-2">
        <span class="text-2xl">🎉</span>
        <strong>新 Key 已生成：{{ created.name }}</strong>
      </div>
      <p class="text-xs" style="color: var(--color-accent)">
        ⚠️ {{ created.notice }}
      </p>
      <div class="flex items-center gap-2">
        <code
          class="flex-1 px-3 py-2 text-sm font-mono break-all rounded"
          style="background: var(--color-ink); color: var(--color-paper)"
        >{{ created.token }}</code>
        <button
          class="px-3 py-2 rounded text-sm cursor-pointer whitespace-nowrap"
          style="background: var(--color-jade); color: white"
          @click="copyToken(created.token)"
        >複製</button>
      </div>
      <details class="text-xs" style="color: var(--color-muted)">
        <summary class="cursor-pointer">如何使用此 Key？</summary>
        <pre class="mt-2 p-2 rounded text-[11px] overflow-x-auto" style="background: rgba(0,0,0,0.04)">curl https://zykongjian.com/api/cantonese/translate \
  -H "Authorization: Bearer {{ created.token }}" \
  -H "Content-Type: application/json" \
  -d '{"sentences":["你食咗飯未"]}'</pre>
      </details>
      <button
        class="text-xs underline cursor-pointer"
        style="color: var(--color-muted)"
        @click="created = null"
      >我已複製，關閉</button>
    </section>

    <!-- 創建表單 -->
    <section class="card p-5 space-y-3">
      <strong>新增一把 API Key</strong>
      <div class="space-y-2">
        <label class="block">
          <span class="text-xs" style="color: var(--color-muted)">名稱（用來區分）</span>
          <input
            v-model="newName"
            type="text"
            maxlength="50"
            placeholder="例如：我的 Mac 命令列腳本"
            class="w-full mt-1 px-3 py-2 rounded border text-sm"
            style="border-color: color-mix(in srgb, var(--color-ink) 15%, transparent)"
          />
        </label>
        <div>
          <span class="text-xs" style="color: var(--color-muted)">允許範圍</span>
          <div class="flex flex-wrap gap-2 mt-1">
            <label
              v-for="s in Object.keys(SCOPE_LABELS)"
              :key="s"
              class="flex items-center gap-1 px-3 py-1 rounded-full border cursor-pointer text-xs"
              :style="newScopes.includes(s)
                ? { background: 'var(--color-ink)', color: 'var(--color-paper)', borderColor: 'transparent' }
                : { borderColor: 'color-mix(in srgb, var(--color-ink) 15%, transparent)' }"
            >
              <input v-model="newScopes" type="checkbox" :value="s" class="hidden" />
              {{ SCOPE_LABELS[s] }}
            </label>
          </div>
        </div>
        <label class="block">
          <span class="text-xs" style="color: var(--color-muted)">有效期（天，空白=永久）</span>
          <input
            v-model="newExpiresInDays"
            type="number"
            min="1"
            max="730"
            placeholder="例如：90"
            class="w-full mt-1 px-3 py-2 rounded border text-sm"
            style="border-color: color-mix(in srgb, var(--color-ink) 15%, transparent)"
          />
        </label>
      </div>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
        style="background: var(--color-accent); color: white"
        :disabled="creating || !newName.trim() || newScopes.length === 0"
        @click="create"
      >{{ creating ? '生成中…' : '生成新 Key' }}</button>
    </section>

    <!-- 錯誤 -->
    <div
      v-if="errorMsg"
      class="card p-3 text-sm"
      style="background: color-mix(in srgb, var(--color-accent) 8%, transparent); color: var(--color-accent)"
    >⚠️ {{ errorMsg }}</div>

    <!-- 列表 -->
    <section class="space-y-2">
      <h3 class="font-semibold">已生成的 Key（{{ keys.length }}）</h3>
      <div v-if="loading" class="text-sm" style="color: var(--color-muted)">載入中…</div>
      <div v-else-if="!keys.length" class="card p-4 text-sm" style="color: var(--color-muted)">
        還沒有 Key。生成第一把後，您寫的任何軟件都能調用此 API。
      </div>
      <div
        v-for="k in keys"
        :key="k.id"
        class="card p-4 flex items-start justify-between gap-3"
        :style="k.revoked_at || isExpired(k) ? { opacity: 0.5 } : {}"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <strong class="text-sm">{{ k.name }}</strong>
            <code class="text-[11px] font-mono px-2 py-0.5 rounded" style="background: rgba(0,0,0,0.05); color: var(--color-muted)">
              {{ k.prefix }}…
            </code>
            <span
              v-if="k.revoked_at"
              class="text-[10px] px-2 py-0.5 rounded-full"
              style="background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent)"
            >已撤銷</span>
            <span
              v-else-if="isExpired(k)"
              class="text-[10px] px-2 py-0.5 rounded-full"
              style="background: rgba(0,0,0,0.05); color: var(--color-muted)"
            >已過期</span>
          </div>
          <div class="text-xs mt-1" style="color: var(--color-muted)">
            範圍：{{ k.scopes.split(',').map(s => SCOPE_LABELS[s] || s).join(' / ') }}
          </div>
          <div class="text-[11px] mt-0.5" style="color: var(--color-muted)">
            建立於 {{ formatDate(k.created_at) }}
            <span v-if="k.last_used_at"> · 最後使用 {{ formatDate(k.last_used_at) }}</span>
            <span v-if="k.expires_at"> · 到期 {{ formatDate(k.expires_at) }}</span>
          </div>
        </div>
        <button
          v-if="!k.revoked_at"
          class="text-xs px-3 py-1.5 rounded cursor-pointer whitespace-nowrap"
          style="border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent); color: var(--color-accent)"
          @click="revoke(k.id)"
        >撤銷</button>
      </div>
    </section>

    <!-- 使用說明 -->
    <section class="card p-5 text-sm space-y-2" style="color: var(--color-muted)">
      <strong style="color: var(--color-ink)">怎樣用？</strong>
      <p>每一次請求都帶上：</p>
      <pre class="p-2 rounded text-[11px] overflow-x-auto" style="background: rgba(0,0,0,0.04)">Authorization: Bearer zy_xxxxxxxx...</pre>
      <p>例：</p>
      <pre class="p-2 rounded text-[11px] overflow-x-auto" style="background: rgba(0,0,0,0.04)">curl https://zykongjian.com/api/cantonese/translate \
  -H "Authorization: Bearer zy_xxx..." \
  -H "Content-Type: application/json" \
  -d '{"sentences":["你食咗飯未"]}'</pre>
      <p>所有調用都計入您的個人配額（每天 200 次）。如有惡意調用，可隨時在此頁撤銷。</p>
    </section>
  </div>
</template>
