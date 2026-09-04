import { ref } from 'vue'
import { useApi } from './useApi'

export interface SpeakOptions {
  voice?: 'male' | 'female'
  speed?: 'slow' | 'normal' | 'fast'
  /** 朗讀完成（或回退播放結束）後觸發一次。中途被 stop() 打斷則不觸發。 */
  onEnded?: () => void
}

/**
 * 朗讀 composable。優先走 Azure TTS（後端代理），
 * 失敗或服務未配置時自動降級到瀏覽器 SpeechSynthesis。
 */
export function useTts() {
  const api = useApi()
  const playing = ref(false)
  const audioEl = ref<HTMLAudioElement | null>(null)
  /** 識別當前播放的 token，stop() 會遞增，舊回調對比後就知道自己已被取代 */
  let currentToken = 0

  async function speak(text: string, opts: SpeakOptions = {}) {
    if (!text) return
    stop()
    const myToken = ++currentToken
    playing.value = true

    let ended = false
    const handleEnded = () => {
      if (ended) return
      ended = true
      // 已被 stop() 或新的 speak() 替代 → 不觸發 onEnded
      if (myToken !== currentToken) return
      playing.value = false
      try { opts.onEnded?.() } catch { /* noop */ }
    }

    try {
      const res = await api.tts({ text, voice: opts.voice, speed: opts.speed })
      if (myToken !== currentToken) return // 期間被取消
      const audio = new Audio(res.url)
      audioEl.value = audio
      audio.onended = handleEnded
      audio.onerror = () => webSpeechFallback(text, opts, myToken, handleEnded)
      await audio.play().catch(() => webSpeechFallback(text, opts, myToken, handleEnded))
    } catch {
      webSpeechFallback(text, opts, myToken, handleEnded)
    }
  }

  function webSpeechFallback(
    text: string,
    opts: SpeakOptions,
    myToken: number,
    onEnded: () => void,
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnded()
      return
    }
    if (myToken !== currentToken) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-HK'
    u.rate = opts.speed === 'slow' ? 0.7 : opts.speed === 'fast' ? 1.25 : 1
    u.onend = () => onEnded()
    u.onerror = () => onEnded()
    window.speechSynthesis.speak(u)
  }

  function stop() {
    currentToken++ // 讓未完成的回調認出自己已被取代
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
