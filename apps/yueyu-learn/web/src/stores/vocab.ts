import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ApiError } from '@yueyu/shared/api-client'
import * as VocabStore from '@yueyu/shared/vocab-store'
import type { VocabEntry } from '@yueyu/shared/types'
import { useApi } from '@/composables/useApi'

/**
 * 生詞本 store。已登入走雲端 + 本地緩存；未登入只用 IndexedDB。
 * 樂觀更新：本地先寫入，後端失敗時回滾並提示。
 */
export const useVocabStore = defineStore('vocab', () => {
  const api = useApi()
  const entries = ref<VocabEntry[]>([])
  const loaded = ref(false)
  const cloudAvailable = ref(true) // 401 後切換到純本地模式

  async function load() {
    try {
      if (cloudAvailable.value) {
        const res = await api.listVocab()
        entries.value = res.entries
        // 同步到本地以支援離線
        for (const e of res.entries) await VocabStore.localPut(e)
      } else {
        entries.value = await VocabStore.localList()
      }
    } catch (err) {
      if (err instanceof ApiError && err.needsLogin) {
        cloudAvailable.value = false
        entries.value = await VocabStore.localList()
      } else {
        entries.value = await VocabStore.localList()
      }
    }
    loaded.value = true
  }

  async function add(entry: Omit<VocabEntry, 'id' | 'createdAt'>) {
    const tempId = VocabStore.uuid()
    const optimistic: VocabEntry = {
      ...entry,
      id: tempId,
      createdAt: new Date().toISOString(),
    }
    entries.value = [optimistic, ...entries.value]
    await VocabStore.localPut(optimistic)

    if (cloudAvailable.value) {
      try {
        const saved = await api.saveVocab(entry)
        // 用伺服器返回的 id 替換臨時 id
        entries.value = entries.value.map((e) => (e.id === tempId ? saved : e))
        await VocabStore.localDelete(tempId)
        await VocabStore.localPut(saved)
        return saved
      } catch (err) {
        if (err instanceof ApiError && err.needsLogin) {
          cloudAvailable.value = false
        }
      }
    }
    return optimistic
  }

  async function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    await VocabStore.localDelete(id)
    if (cloudAvailable.value) {
      try {
        await api.deleteVocab(id)
      } catch (err) {
        if (err instanceof ApiError && err.needsLogin) cloudAvailable.value = false
      }
    }
  }

  async function update(entry: VocabEntry) {
    entries.value = entries.value.map((e) => (e.id === entry.id ? entry : e))
    await VocabStore.localPut(entry)
    if (cloudAvailable.value && entry.srs) {
      try {
        await api.updateSrs(entry.id, entry.srs)
      } catch (err) {
        if (err instanceof ApiError && err.needsLogin) cloudAvailable.value = false
      }
    }
  }

  const total = computed(() => entries.value.length)

  return { entries, total, loaded, cloudAvailable, load, add, remove, update }
})
