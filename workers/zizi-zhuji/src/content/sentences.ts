/**
 * 句子接龍庫：小學語文課文 / 生活常用句 / 勵志短句。
 * 句子長度 5–10 字，便於棋盤鋪設與連線拼出。
 */

export interface SentenceEntry {
  text: string;
  category: "課文" | "格言" | "生活" | "成語句";
}

export const SENTENCES: SentenceEntry[] = [
  { text: "讀書是一件快樂的事", category: "課文" },
  { text: "我愛我的家鄉", category: "生活" },
  { text: "陽光照在大地上", category: "課文" },
  { text: "媽媽每天為我準備早餐", category: "生活" },
  { text: "小鳥在樹上唱歌", category: "課文" },
  { text: "春天到處都是綠色", category: "課文" },
  { text: "夏天的太陽很熾熱", category: "課文" },
  { text: "秋天的楓葉紅了", category: "課文" },
  { text: "冬天下了一場大雪", category: "課文" },
  { text: "老師認真地教我們", category: "課文" },

  { text: "有志者事竟成", category: "格言" },
  { text: "讀萬卷書行萬里路", category: "格言" },
  { text: "一寸光陰一寸金", category: "格言" },
  { text: "勝不驕敗不餒", category: "格言" },
  { text: "失敗是成功之母", category: "格言" },
  { text: "活到老學到老", category: "格言" },
  { text: "業精於勤荒於嬉", category: "格言" },
  { text: "玉不琢不成器", category: "格言" },
  { text: "近朱者赤近墨者黑", category: "格言" },
  { text: "三人行必有我師", category: "格言" },
  { text: "誠實是最好的策略", category: "格言" },
  { text: "今日事今日畢", category: "格言" },

  { text: "我們要團結合作", category: "課文" },
  { text: "保護環境人人有責", category: "課文" },
  { text: "助人為快樂之本", category: "格言" },
  { text: "禮貌是第一張名片", category: "生活" },
  { text: "讓座給長輩是美德", category: "生活" },
  { text: "做事要腳踏實地", category: "格言" },
  { text: "勤奮是成功的鑰匙", category: "格言" },
  { text: "夢想需要付出努力", category: "格言" },

  { text: "畫蛇添足是多餘的", category: "成語句" },
  { text: "一寸光陰不可虛度", category: "格言" },
  { text: "守株待兔不可取", category: "成語句" },
  { text: "亡羊補牢未為晚也", category: "成語句" },
  { text: "井底之蛙見識短淺", category: "成語句" },
  { text: "胸有成竹自然成功", category: "成語句" },
];

export const SENTENCE_SET = new Set(SENTENCES.map((s) => s.text));
