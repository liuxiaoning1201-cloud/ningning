import { ref } from 'vue'
import { useApi } from './useApi'

/**
 * 朗讀 composable。優先走 Azure TTS（後端代理），
 * 失敗或服務未配置時自動降級到瀏覽器 SpeechSynthesis。
 */
export function useTts() {
  const api = useApi()
  const playing = ref(false)
  const audioEl = ref<HTMLAudioElement | null>(null)

  async function speak(text: string, opts: { voice?: 'male' | 'female'; speed?: 'slow' | 'normal' | 'fast' } = {}) {
    if (!text) return
    stop()
    playing.value = true
    try {
      const res = await api.tts({ text, voice: opts.voice, speed: opts.speed })
      const audio = new Audio(res.url)
      audioEl.value = audio
      audio.onended = () => { playing.value = false }
      audio.onerror = () => {
        playing.value = false
        webSpeechFallback(text, opts)
      }
      await audio.play().catch(() => webSpeechFallback(text, opts))
    } catch {
      webSpeechFallback(text, opts)
    }
  }

  function webSpeechFallback(text: string, opts: { speed?: 'slow' | 'normal' | 'fast' } = {}) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      playing.value = false
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-HK'
    u.rate = opts.speed === 'slow' ? 0.7 : opts.speed === 'fast' ? 1.25 : 1
    u.onend = () => { playing.value = false }
    u.onerror = () => { playing.value = false }
    window.speechSynthesis.speak(u)
  }

  function stop() {
    if (audioEl.value) {
      audioEl.value.pause()
      audioEl.value = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    playing.value = false
  }

  return { speak, stop, playing }
}
