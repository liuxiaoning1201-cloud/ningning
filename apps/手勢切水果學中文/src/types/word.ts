export type LangRead = 'mandarin' | 'cantonese';

export interface WordEntry {
  /** 主要顯示／朗讀文字 */
  word: string;
  hanzi?: string;
  pinyin?: string;
  langRead: LangRead;
}

export const STORAGE_KEY_WORDS = 'fruit-cn-learning-words-v1';
