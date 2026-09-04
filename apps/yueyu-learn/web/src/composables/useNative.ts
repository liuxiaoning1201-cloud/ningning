/**
 * 與原生（Capacitor 自定義插件）的橋。
 *
 * - 啟動時檢查是否在 Capacitor 容器內運行；若不是（純 PWA / 桌面瀏覽器），全部變成 no-op。
 * - 提供：
 *     consumeSharedImages()   iOS Share Extension 寫入的截圖
 *     hasOverlayPermission()  Android 浮窗權限狀態
 *     requestOverlayPermission()
 *     startFloatingBubble()
 */
import { ref } from 'vue'

interface CapacitorBridge {
  Plugins: Record<string, unknown>
  isNativePlatform?: () => boolean
  getPlatform?: () => 'ios' | 'android' | 'web'
}

declare global {
  interface Window {
    Capacitor?: CapacitorBridge
  }
}

export interface SharedImage {
  filename: string
  dataUrl: string
  size: number
}

interface ShareInboxPlugin {
  consumePending: () => Promise<{ images: SharedImage[] }>
  clearPending: () => Promise<void>
}

interface FloatingOcrPlugin {
  hasOverlayPermission: () => Promise<{ granted: boolean }>
  requestOverlayPermission: () => Promise<void>
  startBubble: () => Promise<void>
  stopBubble: () => Promise<void>
}

const platform = ref<'ios' | 'android' | 'web'>('web')
const isNative = ref(false)

function detect() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined
  if (!cap) return
  isNative.value = cap.isNativePlatform?.() ?? false
  platform.value = cap.getPlatform?.() ?? 'web'
}

detect()

function plugin<T>(name: string): T | null {
  const cap = window.Capacitor
  if (!cap || !cap.Plugins) return null
  return (cap.Plugins as Record<string, T>)[name] ?? null
}

export function useNative() {
  async function consumeSharedImages(): Promise<SharedImage[]> {
    const p = plugin<ShareInboxPlugin>('ShareInbox')
    if (!p) return []
    try {
      const { images } = await p.consumePending()
      return images
    } catch (e) {
      console.warn('consumeSharedImages failed', e)
      return []
    }
  }

  async function hasOverlayPermission(): Promise<boolean> {
    const p = plugin<FloatingOcrPlugin>('FloatingOcr')
    if (!p) return false
    try {
      const { granted } = await p.hasOverlayPermission()
      return granted
    } catch {
      return false
    }
  }

  async function requestOverlayPermission(): Promise<void> {
    const p = plugin<FloatingOcrPlugin>('FloatingOcr')
    if (!p) return
    try {
      await p.requestOverlayPermission()
    } catch (e) {
      console.warn('requestOverlayPermission failed', e)
    }
  }

  async function startFloatingBubble(): Promise<void> {
    const p = plugin<FloatingOcrPlugin>('FloatingOcr')
    if (!p) return
    await p.startBubble()
  }

  async function stopFloatingBubble(): Promise<void> {
    const p = plugin<FloatingOcrPlugin>('FloatingOcr')
    if (!p) return
    await p.stopBubble()
  }

  return {
    isNative,
    platform,
    consumeSharedImages,
    hasOverlayPermission,
    requestOverlayPermission,
    startFloatingBubble,
    stopFloatingBubble,
  }
}
