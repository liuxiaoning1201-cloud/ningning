import { CantoneseApi } from '@yueyu/shared/api-client'

let _api: CantoneseApi | null = null

export function useApi(): CantoneseApi {
  if (!_api) {
    // Capacitor 容器（iOS/Android APP）內的網頁宿主是 capacitor://localhost，
    // 必須走完整域名；純網頁 / PWA 走相對路徑即可。
    const apiBase =
      (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.())
        ? (import.meta.env.VITE_API_BASE || 'https://zykongjian.com')
        : ''

    _api = new CantoneseApi({
      baseUrl: apiBase,
      client: 'web',
    })
  }
  return _api
}
