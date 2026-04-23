export type LangRead = 'mandarin' | 'cantonese';

export interface WordEntry {
  /** 主要顯示／朗讀文字 */
  word: string;
  hanzi?: string;
  pinyin?: string;
  langRead: LangRead;
  /** 主題標籤（可多個）：人物、動物、前鼻音、後鼻音… */
  tags?: string[];
  /** 難度：1 簡單、2 中等、3 挑戰 */
  difficulty?: 1 | 2 | 3;
}

export const STORAGE_KEY_WORDS = 'fruit-cn-learning-words-v1';
