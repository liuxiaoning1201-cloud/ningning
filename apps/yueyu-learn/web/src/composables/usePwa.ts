/**
 * 註冊 Service Worker（PWA）+ 暴露「安裝到桌面」事件。
 *
 * 在 main.ts 開始時調用 registerPwa()，組件可用 useInstallPrompt() 取得 install button。
 */
import { ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const installEvent = ref<BeforeInstallPromptEvent | null>(null)
const installable = ref(false)
const installed = ref(false)

export function registerPwa() {
  if (typeof window === 'undefined') return
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swPath = `${import.meta.env.BASE_URL}sw.js`
      navigator.serviceWorker.register(swPath, { scope: import.meta.env.BASE_URL }).catch((err) => {
        console.warn('Service worker register failed', err)
      })
    })
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent.value = e as BeforeInstallPromptEvent
    installable.value = true
  })

  window.addEventListener('appinstalled', () => {
    installed.value = true
    installable.value = false
    installEvent.value = null
  })
}

export function useInstallPrompt() {
  async function promptInstall() {
    if (!installEvent.value) return false
    await installEvent.value.prompt()
    const choice = await installEvent.value.userChoice
    return choice.outcome === 'accepted'
  }
  return { installable, installed, promptInstall }
}
