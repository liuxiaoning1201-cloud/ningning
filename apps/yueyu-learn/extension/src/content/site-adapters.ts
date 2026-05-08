/**
 * 站點適配器：每個視頻網站的字幕容器選擇器與位置策略不同，
 * 在此集中定義，content script 只調用 detectAdapter() 即可。
 *
 * 新增站點時：
 *   1. 在 SITE_ADAPTERS 加一條 { match, name, getCaption, getVideoEl?, ... }
 *   2. 在 manifest.json content_scripts.matches 補上對應網域
 */

export interface SiteAdapter {
  /** 顯示名 */
  name: string;
  /** 站點識別（用 location.hostname 判斷） */
  match: (hostname: string) => boolean;
  /** 從 DOM 抽取當前字幕文本（多行用 \n 連接） */
  getCaption: () => string;
  /** 取得視頻元素（用於拿時間戳、暫停回放） */
  getVideoEl: () => HTMLVideoElement | null;
  /** 取得當前頁面標題（用於收藏時帶劇名） */
  getTitle: () => string;
  /** 字幕區域 CSS 選擇器（用於雙軌叠加定位） */
  captionContainerSelector?: string;
}

const youtubeAdapter: SiteAdapter = {
  name: 'YouTube',
  match: (h) => h === 'www.youtube.com' || h === 'm.youtube.com' || h === 'youtube.com',
  getCaption: () => {
    const segs = document.querySelectorAll<HTMLElement>('.ytp-caption-segment');
    return Array.from(segs).map((el) => el.textContent || '').join('').trim();
  },
  getVideoEl: () => document.querySelector<HTMLVideoElement>('video.html5-main-video'),
  getTitle: () => document.title.replace(/ - YouTube$/, '').trim(),
  captionContainerSelector: '.ytp-caption-window-container',
};

const bilibiliAdapter: SiteAdapter = {
  name: 'bilibili',
  match: (h) => h === 'www.bilibili.com' || h === 'bilibili.com' || h === 'm.bilibili.com',
  getCaption: () => {
    // bilibili 的彈幕字幕在 .bpx-player-subtitle-panel-text 或 .bilibili-player-video-subtitle
    const sel = '.bpx-player-subtitle-panel-text, .bili-subtitle-x-wrap, .bilibili-player-video-subtitle';
    const els = document.querySelectorAll<HTMLElement>(sel);
    return Array.from(els).map((el) => el.textContent || '').join(' ').trim();
  },
  getVideoEl: () =>
    document.querySelector<HTMLVideoElement>('.bpx-player-video-wrap video, .bilibili-player-video video, video'),
  getTitle: () => document.querySelector('.video-title, .video-info-title-t')?.textContent?.trim() || document.title,
  captionContainerSelector: '.bpx-player-subtitle-panel, .bilibili-player-video-subtitle',
};

const tvbAdapter: SiteAdapter = {
  name: 'TVB',
  match: (h) => h.endsWith('tvb.com') || h.endsWith('mytvsuper.com'),
  getCaption: () => {
    // TVB / myTV SUPER 網頁版字幕通常在 .vjs-text-track-display 或自家組件
    const sel = '.vjs-text-track-display, .vjs-text-track-cue, .subtitles, .player-subtitle';
    const els = document.querySelectorAll<HTMLElement>(sel);
    return Array.from(els).map((el) => el.textContent || '').join(' ').trim();
  },
  getVideoEl: () => document.querySelector<HTMLVideoElement>('video'),
  getTitle: () =>
    document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.content?.trim() || document.title,
  captionContainerSelector: '.vjs-text-track-display, .player-subtitle',
};

/** 兜底適配器：使用通用 video > track 探查 */
const genericAdapter: SiteAdapter = {
  name: 'Generic',
  match: () => true,
  getCaption: () => {
    // 通用做法：找 video 旁的 cue 容器
    const sel = 'video[controls] + div, .vjs-text-track-display, [class*="caption"], [class*="subtitle"]';
    const els = document.querySelectorAll<HTMLElement>(sel);
    return Array.from(els)
      .map((el) => el.textContent || '')
      .filter((s) => s && s.length < 200)
      .join(' ')
      .trim();
  },
  getVideoEl: () => document.querySelector<HTMLVideoElement>('video'),
  getTitle: () => document.title,
};

const SITE_ADAPTERS: SiteAdapter[] = [youtubeAdapter, bilibiliAdapter, tvbAdapter];

export function detectAdapter(hostname: string = location.hostname): SiteAdapter {
  return SITE_ADAPTERS.find((a) => a.match(hostname)) ?? genericAdapter;
}
