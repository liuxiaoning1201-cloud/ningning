#!/usr/bin/env node
/**
 * 鏡像 qingyiu.com 上現役的「巧手拼拼字」靜態包，只改首頁 DOM 順序／文案。
 * 不重建、不替換標題五字的 HomeStroke 動畫。
 *
 * 產物：apps/巧手拼拼字/.worker-dist/
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(APP, '.worker-dist');
const PREFIX = '巧手拼拼字';
const NEST = join(OUT, PREFIX);
const LIVE = `https://qingyiu.com/${encodeURIComponent(PREFIX)}`;
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function fetchBuf(path) {
  const url = `${LIVE}/${path}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') || '';
  if (path.match(/\.(webp|svg|js|css)$/) && type.includes('text/html')) {
    throw new Error(`SPA fallback HTML for ${path}`);
  }
  return buf;
}

function write(rel, buf) {
  const dest = join(NEST, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
}

const OLD_SUB = `f[1]||=d(\`p\`,{class:\`home-sub\`},[_(\` 筷子平放，就是橫。\`),d(\`br\`),_(\` 蠟燭站直，就是直。\`),d(\`br\`),_(\` 雨傘往下一鈎，就是鈎。\`),d(\`br\`),_(\` 把東西拖進米字格，對了物品、位置和順序，字就站起來了。 \`)],-1),d(\`div\`,ae,`;
const NEW_SUB_OPEN = `d(\`div\`,ae,`;
const OLD_FOOT = `)),64))]),d(\`p\`,ue,`;
const NEW_FOOT = `)),64))]),f[1]||=d(\`p\`,{class:\`home-sub\`},[_(\` 筷子平放，就是橫。\`),d(\`br\`),_(\` 蠟燭站直，就是直。\`),d(\`br\`),_(\` 雨傘往下一鈎，就是鈎。把東西拖進米字格，對了物品、位置和順序，字就站起來了。\`)],-1),d(\`p\`,ue,`;

function patchHomeView(js) {
  if (js.includes('雨傘往下一鈎，就是鈎。把東西拖進米字格')) {
    console.log('✓ HomeView 已是目標排版，略過');
    return js;
  }
  if (!js.includes(OLD_SUB) || !js.includes(OLD_FOOT)) {
    throw new Error('HomeView 片段與預期不符，拒絕改檔（以免動到標題動畫）');
  }
  let out = js.replace(OLD_SUB, NEW_SUB_OPEN);
  if (!out.includes(OLD_FOOT)) {
    throw new Error('移除 home-sub 後找不到頁腳錨點');
  }
  out = out.replace(OLD_FOOT, NEW_FOOT);
  if (!out.includes('雨傘往下一鈎，就是鈎。把東西拖進米字格')) {
    throw new Error('末兩句未合併，patch 失敗');
  }
  return out;
}

const html = (await fetchBuf('')).toString('utf8');
const assets = [...html.matchAll(/(?:src|href)="(?:\.\/|\/[^"]+\/)?(assets\/[^"]+)"/g)].map((m) => m[1]);
const indexJs = assets.find((a) => /assets\/index-.*\.js$/.test(a));
if (!indexJs) throw new Error('index.html 沒有 index-*.js');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(NEST, { recursive: true });
write('index.html', html);

const indexBuf = await fetchBuf(indexJs);
write(indexJs, indexBuf);
const indexText = indexBuf.toString('utf8');

const extraAssets = [
  ...indexText.matchAll(/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g),
].map((m) => m[0]);
const objects = [...indexText.matchAll(/image:`([^`]+)`/g)].map((m) => m[1]);

const files = new Set([...assets, ...extraAssets, 'favicon.svg', ...objects.map((f) => `objects/${f}`)]);
files.delete(indexJs);

for (const rel of [...files].sort()) {
  process.stdout.write(`↓ ${rel}\n`);
  write(rel, await fetchBuf(rel));
}

const homeJsRel = [...files].find((f) => /assets\/HomeView-.*\.js$/.test(f));
if (!homeJsRel) throw new Error('找不到 HomeView-*.js');
const homePath = join(NEST, homeJsRel);
const before = readFileSync(homePath, 'utf8');
const logoBefore = before.slice(0, before.indexOf('ie={class:`home`}'));
const after = patchHomeView(before);
const logoAfter = after.slice(0, after.indexOf('ie={class:`home`}'));
if (logoBefore !== logoAfter) {
  throw new Error('patch 動到了 HomeLogo / HomeStroke，已中止');
}
writeFileSync(homePath, after);

const rootHtml = join(OUT, 'index.html');
if (existsSync(join(NEST, 'index.html'))) {
  cpSync(join(NEST, 'index.html'), rootHtml);
}

console.log(`✓ 鏡像並改排版 → ${OUT}`);
console.log(`  HomeView: ${homeJsRel}`);
