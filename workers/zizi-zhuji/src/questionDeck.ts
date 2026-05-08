/**
 * 答題式（QA）模式題卡產生器。
 * 從成語庫衍生 4 種題型，按難度（1-5）混合產出，避免重題。
 */

import type { QuestionCard, QuestionType } from "../../../shared/zizizhujiTypes.js";
import { BUILTIN_IDIOMS } from "./content/idioms.js";

interface Pool {
  cards: QuestionCard[];
  served: Set<string>;
}

const POOLS: Map<number, Pool> = new Map();

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rngFromSeed(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** 注音 ↔ 漢字（簡化版，用內建小表） */
const PHONETIC_TABLE: { ch: string; pinyin: string; alts: string[] }[] = [
  { ch: "明", pinyin: "ㄇㄧㄥˊ", alts: ["明","名","鳴","民"] },
  { ch: "光", pinyin: "ㄍㄨㄤ",  alts: ["光","廣","公","工"] },
  { ch: "花", pinyin: "ㄏㄨㄚ",  alts: ["花","華","話","畫"] },
  { ch: "心", pinyin: "ㄒㄧㄣ",  alts: ["心","新","信","深"] },
  { ch: "風", pinyin: "ㄈㄥ",    alts: ["風","封","峰","逢"] },
  { ch: "山", pinyin: "ㄕㄢ",    alts: ["山","三","深","上"] },
  { ch: "水", pinyin: "ㄕㄨㄟˇ", alts: ["水","誰","睡","稅"] },
  { ch: "讀", pinyin: "ㄉㄨˊ",   alts: ["讀","獨","毒","度"] },
  { ch: "書", pinyin: "ㄕㄨ",    alts: ["書","樹","熟","屬"] },
  { ch: "魚", pinyin: "ㄩˊ",     alts: ["魚","余","於","愚"] },
  { ch: "鳥", pinyin: "ㄋㄧㄠˇ", alts: ["鳥","了","料","聊"] },
  { ch: "馬", pinyin: "ㄇㄚˇ",   alts: ["馬","媽","麻","罵"] },
  { ch: "雪", pinyin: "ㄒㄩㄝˇ", alts: ["雪","學","血","靴"] },
];

const NEAR_FORM: { correct: string; def: string; foils: string[] }[] = [
  { correct: "己", def: "自己的「己」", foils: ["已", "巳", "巴"] },
  { correct: "已", def: "已經的「已」", foils: ["己", "巳", "已"] },
  { correct: "代", def: "時代的「代」", foils: ["伐", "化", "找"] },
  { correct: "做", def: "做事的「做」", foils: ["作", "伢", "佐"] },
  { correct: "象", def: "現象的「象」", foils: ["像", "豪", "豫"] },
  { correct: "書", def: "讀書的「書」", foils: ["晝", "畫", "盡"] },
  { correct: "未", def: "未來的「未」", foils: ["末", "本", "禾"] },
  { correct: "末", def: "週末的「末」", foils: ["未", "本", "禾"] },
  { correct: "辨", def: "辨別的「辨」", foils: ["辯", "辦", "瓣"] },
  { correct: "辯", def: "爭辯的「辯」", foils: ["辨", "辦", "瓣"] },
];

function buildPhoneticCards(): QuestionCard[] {
  return PHONETIC_TABLE.map((row, i) => ({
    id: `ph-${i}`,
    type: "phonetic" as QuestionType,
    prompt: `「${row.pinyin}」對應哪個字？`,
    options: row.alts,
    correctIndex: row.alts.indexOf(row.ch),
    hint: `這個字念 ${row.pinyin}`,
  }));
}

function buildNearFormCards(): QuestionCard[] {
  return NEAR_FORM.map((row, i) => {
    const opts = [row.correct, ...row.foils.filter((f) => f !== row.correct)].slice(0, 4);
    return {
      id: `nf-${i}`,
      type: "near-form" as QuestionType,
      prompt: `下列哪個字是「${row.def}」？`,
      options: opts,
      correctIndex: opts.indexOf(row.correct),
    };
  });
}

function buildIdiomMeaningCards(): QuestionCard[] {
  const cards: QuestionCard[] = [];
  for (let i = 0; i < BUILTIN_IDIOMS.length; i++) {
    const target = BUILTIN_IDIOMS[i];
    const wrongs = pickRandomDefs(target.text, 3);
    if (wrongs.length < 3) continue;
    const opts = shuffleArr([target.definition, ...wrongs]);
    cards.push({
      id: `im-${i}`,
      type: "idiom-meaning",
      prompt: `「${target.text}」的意思是？`,
      options: opts,
      correctIndex: opts.indexOf(target.definition),
      hint: target.text.split("").join("·"),
    });
  }
  return cards;
}

function buildComposeCards(): QuestionCard[] {
  const seeds = [
    { ch: "明", correct: "明亮", foils: ["黑暗","沉重","痛苦"] },
    { ch: "讀", correct: "讀書", foils: ["寫字","畫畫","跑步"] },
    { ch: "心", correct: "心情", foils: ["腳踝","拳頭","風箏"] },
    { ch: "山", correct: "山林", foils: ["海洋","沙漠","城市"] },
    { ch: "風", correct: "風景", foils: ["飯桌","沙發","汽車"] },
    { ch: "花", correct: "花朵", foils: ["石頭","椅子","泥巴"] },
    { ch: "水", correct: "水流", foils: ["火堆","泥土","電腦"] },
    { ch: "光", correct: "光亮", foils: ["黑暗","重量","溫度"] },
    { ch: "書", correct: "書本", foils: ["桌椅","水果","汽車"] },
  ];
  return seeds.map((s, i) => {
    const opts = shuffleArr([s.correct, ...s.foils]);
    return {
      id: `co-${i}`,
      type: "compose",
      prompt: `用「${s.ch}」字組成一個詞，下列哪個是？`,
      options: opts,
      correctIndex: opts.indexOf(s.correct),
    };
  });
}

function pickRandomDefs(exclude: string, n: number): string[] {
  const arr = BUILTIN_IDIOMS.filter((i) => i.text !== exclude).map((i) => i.definition);
  return shuffleArr(arr).slice(0, n);
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPoolForDifficulty(difficulty: number): Pool {
  const cards: QuestionCard[] = [];
  if (difficulty <= 2) {
    cards.push(...buildPhoneticCards());
    cards.push(...buildNearFormCards());
    cards.push(...buildComposeCards().slice(0, 5));
  } else if (difficulty <= 4) {
    cards.push(...buildComposeCards());
    cards.push(...buildNearFormCards());
    cards.push(...buildIdiomMeaningCards().slice(0, Math.min(40, BUILTIN_IDIOMS.length)));
  } else {
    cards.push(...buildIdiomMeaningCards());
    cards.push(...buildNearFormCards().slice(0, 5));
  }
  return { cards, served: new Set() };
}

export function drawQuestion(difficulty: number, seed: number): QuestionCard {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  let pool = POOLS.get(d);
  if (!pool) {
    pool = buildPoolForDifficulty(d);
    POOLS.set(d, pool);
  }
  const rng = rngFromSeed(seed);
  const remaining = pool.cards.filter((c) => !pool!.served.has(c.id));
  const list = remaining.length > 0 ? remaining : pool.cards;
  const pick = shuffle(list, rng)[0];
  pool.served.add(pick.id);
  if (pool.served.size > pool.cards.length * 0.8) pool.served.clear();
  return { ...pick, id: `${pick.id}-${seed.toString(36)}` };
}
