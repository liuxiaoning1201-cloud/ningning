/**
 * 粵語學習 PWA Service Worker（極簡）
 *
 * 策略：
 *   1. 靜態資源（HTML / JS / CSS / 字體）走 stale-while-revalidate
 *   2. /api/* 永遠走網路（涉及鑑權與配額，不能緩存）
 *   3. R2 音頻（/api/cantonese/audio/*）走 cache-first（不可變內容）
 *
 * 不使用 Workbox 等大依賴，純 Service Worker API，零打包成本。
 */
const CACHE_VERSION = 'yueyu-v1'
const AUDIO_CACHE = 'yueyu-audio-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== AUDIO_CACHE)
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // 鑑權與動態 API：永遠走網路
  if (url.pathname.startsWith('/api/cantonese/audio/')) {
    event.respondWith(audioCacheFirst(req))
    return
  }
  if (url.pathname.startsWith('/api/')) return

  // 靜態資源：stale-while-revalidate
  if (url.origin === location.origin && url.pathname.startsWith('/yueyu/')) {
    event.respondWith(staleWhileRevalidate(req))
  }
})

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(req)
  const fetchAndUpdate = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => {})
      return res
    })
    .catch(() => cached)
  return cached || fetchAndUpdate
}

async function audioCacheFirst(req) {
  const cache = await caches.open(AUDIO_CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone()).catch(() => {})
  return res
}
