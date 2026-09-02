#!/usr/bin/env node
/**
 * 由開源 cnchar（cnchar-order + cnchar-trad）產生繁體筆畫名稱表。
 *
 * 香港教育局沒有機器可讀的筆順 API。課堂字形依《常用字字形表》，
 * 開源裡最接近的筆畫名稱來源是 cnchar 繁體筆順；路徑動畫仍用 animCJK ZhHant。
 *
 * 含「|」的名稱（斜鈎|臥鈎、橫撇|橫鈎）不寫入，留給幾何分類。
 * 用法：node scripts/gen-official-strokes.mjs
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cnchar = require('cnchar');
cnchar.use(require('cnchar-order'), require('cnchar-trad'));

const HERE = dirname(fileURLToPath(import.meta.url));
const CHARSET = resolve(HERE, '../src/data/hkCharset.json');
const OUT = resolve(HERE, '../src/data/officialStrokeCodes.json');

/** 單一字母編碼，對得上我們的 23 種 StrokeId。 */
const NAME_TO_CODE = {
  横: 'h',
  竖: 's',
  撇: 'p',
  捺: 'n',
  点: 'd',
  点1: 'd',
  点2: 'd',
  提: 't',
  横折: 'A',
  横折钩: 'B',
  横撇: 'C',
  横撇弯钩: 'D',
  横折弯钩: 'E',
  横钩: 'F',
  竖折: 'G',
  竖折折: 'H',
  竖折折钩: 'I',
  竖钩: 'J',
  竖弯钩: 'K',
  竖弯: 'K',
  竖提: 'L',
  撇点: 'M',
  撇折: 'N',
  弯钩: 'O',
  卧钩: 'P',
  斜钩: 'Q',
};

function namesOf(ch) {
  const raw = cnchar.stroke(ch, 'order', 'name');
  if (!Array.isArray(raw) || !Array.isArray(raw[0]) || !raw[0].length) return null;
  return raw[0].map((n) => String(n));
}

function encode(names) {
  let out = '';
  let known = 0;
  for (const name of names) {
    if (name.includes('|')) {
      out += '.';
      continue;
    }
    const code = NAME_TO_CODE[name];
    if (!code) {
      out += '.';
      continue;
    }
    out += code;
    known += 1;
  }
  return known ? out : null;
}

const charset = JSON.parse(await readFile(CHARSET, 'utf8'));
const chars = [...charset.chars];
const dict = {};
let ok = 0;
let skip = 0;

for (const ch of chars) {
  const names = namesOf(ch);
  if (!names) {
    skip += 1;
    continue;
  }
  const code = encode(names);
  if (!code) {
    skip += 1;
    continue;
  }
  dict[ch] = code;
  ok += 1;
}

await writeFile(OUT, `${JSON.stringify(dict)}\n`);
process.stdout.write(`official strokes: ${ok} 字，略過 ${skip}，寫入 ${OUT}\n`);
process.stdout.write(`難: ${dict['難'] ?? '(無)'}\n`);
process.stdout.write(`心: ${dict['心'] ?? '(無)'}\n`);
process.stdout.write(`必: ${dict['必'] ?? '(無)'}\n`);
process.stdout.write(`口: ${dict['口'] ?? '(無)'}\n`);
