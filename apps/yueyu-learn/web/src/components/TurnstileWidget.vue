<script setup lang="ts">
/**
 * Cloudflare Turnstile 隱形人機驗證 widget。
 *
 * MVP 階段預設不啟用（已強制登入）。
 * 若日後想對未登入流量限速 + Turnstile，把 site key 配置到環境並掛載此組件即可。
 *
 * 使用：
 *   <TurnstileWidget site-key="0x4AAA..." @verified="(token) => useToken(token)" />
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  siteKey: string
  size?: 'normal' | 'compact' | 'invisible'
}>()
const emit = defineEmits<{ verified: [token: string] }>()

const containerEl = ref<HTMLDivElement | null>(null)
let widgetId: string | undefined

onMounted(async () => {
  await loadScript()
  // @ts-expect-error - turnstile 是 CDN 注入的全域對象
  if (!window.turnstile) return
  // @ts-expect-error
  widgetId = window.turnstile.render(containerEl.value, {
    sitekey: props.siteKey,
    size: props.size ?? 'invisible',
    callback: (token: string) => emit('verified', token),
  })
})

onBeforeUnmount(() => {
  // @ts-expect-error
  if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId)
})

function loadScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById('cf-turnstile-script')) return resolve()
    const s = document.createElement('script')
    s.id = 'cf-turnstile-script'
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}
</script>

<template>
  <div ref="containerEl" />
</template>
