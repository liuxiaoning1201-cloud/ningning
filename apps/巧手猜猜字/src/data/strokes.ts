import type { StrokeDef, StrokeId } from '@/types';

/**
 * 香港小學筆畫與生活物品的對照表：6 基本 + 17 複合 = 23 件。
 *
 * 兩條硬規則，由 assertStrokeTableIntegrity 在載入時檢查：
 *   1. 一個筆畫只對一件物品
 *   2. 一件物品只代表一個筆畫
 *
 * 變化形態（平撇、直撇、平捺、左頓點、右頓點）沿用母筆畫同一件物品，只改擺放角度，
 * 因此不另立 StrokeId；點另備左斜與右斜兩個預設朝向。
 */
export const STROKES: StrokeDef[] = [
  // ── 基本筆畫 ──
  {
    id: 'dian',
    name: '點',
    shape: '丶',
    category: 'basic',
    objectName: '水滴',
    image: 'dian-shuidi.webp',
    material: '水',
    stage: 1,
    examples: ['主', '卜'],
    hint: '一顆水滴。三點水裡的點方向不同，用左斜或右斜。',
    // 水滴是一整顆，比一個點粗，縮一點才不會蓋掉旁邊的筆
    drawScale: 0.82,
    variants: [
      { key: 'up', label: '直立', image: 'dian-shuidi.webp', baseAngle: 90 },
      { key: 'left', label: '左斜', image: 'dian-shuidi-zuo.webp', baseAngle: 135 },
      { key: 'right', label: '右斜', image: 'dian-shuidi-you.webp', baseAngle: 45 },
    ],
  },
  {
    id: 'heng',
    name: '橫',
    shape: '一',
    category: 'basic',
    objectName: '筷子',
    image: 'heng-kuaizi.webp',
    material: '木',
    stage: 1,
    examples: ['一', '三'],
    hint: '一支筷子平放。',
  },
  {
    id: 'zhi',
    name: '直',
    shape: '丨',
    mainlandName: '豎',
    category: 'basic',
    objectName: '蠟燭',
    image: 'zhi-lazhu.webp',
    material: '蠟',
    stage: 1,
    examples: ['十', '川'],
    hint: '蠟燭要站直，不要歪。短直用短蠟燭，長直用長的。',
    drawScale: 0.9,
  },
  {
    id: 'pie',
    name: '撇',
    shape: '丿',
    category: 'basic',
    objectName: '羽毛',
    image: 'pie-yumao.webp',
    material: '羽',
    stage: 1,
    examples: ['人', '竹'],
    hint: '羽毛從右上掃到左下。長撇用較長的羽毛，並跟著那一筆的角度。',
    drawScale: 0.82,
  },
  {
    id: 'na',
    name: '捺',
    shape: '㇏',
    mainlandName: '撇',
    category: 'basic',
    objectName: '滑梯',
    image: 'na-huati.webp',
    material: '塑膠滑面',
    stage: 1,
    examples: ['人', '木'],
    hint: '滑梯從左上滑到右下。長捺滑梯也較長。',
    drawScale: 0.84,
  },
  {
    id: 'ti',
    name: '趯',
    shape: '㇀',
    mainlandName: '提',
    category: 'basic',
    objectName: '紅蘿蔔',
    image: 'ti-luobo.webp',
    material: '蔬菜',
    stage: 1,
    examples: ['刁', '氵'],
    hint: '葉子在左下，尖端朝右上挑。',
  },

  // ── 複合筆畫 ──
  {
    id: 'hengzhi',
    name: '橫直',
    shape: '𠃍',
    mainlandName: '橫折',
    category: 'compound',
    objectName: '曲尺',
    image: 'hengzhi-quchi.webp',
    material: '黃銅',
    stage: 1,
    examples: ['日', '口', '田'],
    hint: '橫長直短，直角在右上。',
  },
  {
    id: 'hengzhigou',
    name: '橫直鈎',
    shape: '𠃌',
    mainlandName: '橫折鈎',
    category: 'compound',
    objectName: '衣帽鈎',
    image: 'hengzhigou-yimaogou.webp',
    material: '金屬',
    stage: 1,
    examples: ['月', '門', '永', '力', '方'],
    hint: '像數字 7，尾端有小鈎。',
  },
  {
    id: 'hengpie',
    name: '橫撇',
    shape: 'フ',
    mainlandName: '橫折撇',
    category: 'compound',
    objectName: '三角旗',
    image: 'hengpie-sanjiaoqi.webp',
    material: '布',
    stage: 1,
    examples: ['又', '夕', '水'],
    hint: '橫棍在上，旗子從右端垂向左下。',
  },
  {
    id: 'hengpiewangou',
    name: '橫撇彎鈎',
    shape: 'ㄋ',
    mainlandName: '橫撇彎鈎',
    category: 'compound',
    objectName: '掛耳耳機',
    image: 'hengpiewangou-erji.webp',
    material: '塑膠',
    stage: 3,
    examples: ['奶', '乃', '那'],
    hint: '短橫、左下撇、再彎成鈎，三段都要看見。',
  },
  {
    id: 'hengwangou',
    name: '橫彎鈎',
    shape: '乙',
    mainlandName: '橫折彎鈎',
    category: 'compound',
    objectName: '單車彎把',
    image: 'hengwangou-danche.webp',
    material: '車件',
    stage: 3,
    examples: ['吃', '乙', '九'],
    hint: '頂橫短，下面的彎鈎大而明顯。',
  },
  {
    id: 'henggou',
    name: '橫鈎',
    shape: '乛',
    mainlandName: '橫鈎',
    category: 'compound',
    objectName: '屋簷',
    image: 'henggou-wuyan.webp',
    material: '瓦',
    stage: 1,
    examples: ['宀', '買', '家'],
    hint: '一條短橫，右端一個小下鈎。',
  },
  {
    id: 'zhizheng',
    name: '直橫',
    shape: '∟',
    mainlandName: '豎折',
    category: 'compound',
    objectName: '沙發',
    image: 'zhizheng-shafa.webp',
    material: '布藝家具',
    stage: 1,
    examples: ['山', '世'],
    hint: '側看沙發：靠背直、座墊橫。',
  },
  {
    id: 'zhizhengzhi',
    name: '直橫直',
    shape: 'ㄣ',
    mainlandName: '豎折折',
    category: 'compound',
    objectName: '釘書釘',
    image: 'zhizhengzhi-dingshuding.webp',
    material: '金屬線',
    stage: 4,
    examples: ['亞', '鼎'],
    hint: '像方角的 Z：直、橫、再直。',
  },
  {
    id: 'zhizhengzhigou',
    name: '直橫直鈎',
    shape: 'ㄅ',
    mainlandName: '豎折折鈎',
    category: 'compound',
    objectName: '弓',
    image: 'zhizhengzhigou-gong.webp',
    material: '木與弦',
    stage: 3,
    examples: ['弓', '弟', '彈'],
    hint: '直、橫、直，末端一個短鈎。不是平滑的 C。',
  },
  {
    id: 'zhigou',
    name: '直鈎',
    shape: '亅',
    mainlandName: '豎鈎',
    category: 'compound',
    objectName: '雨傘',
    image: 'zhigou-yusan.webp',
    material: '傘布',
    stage: 1,
    examples: ['了', '牙', '小', '水', '寸'],
    hint: '收起的直傘，彎柄在最下面向左。',
  },
  {
    id: 'zhiwangou',
    name: '直彎鈎',
    shape: '乚',
    mainlandName: '豎彎鈎',
    category: 'compound',
    objectName: '長靴',
    image: 'zhiwangou-changxue.webp',
    material: '皮革',
    stage: 2,
    examples: ['也', '兒', '孔'],
    hint: '靴筒直立，靴頭向右再微微上翹。',
  },
  {
    id: 'zhiti',
    name: '直趯',
    shape: 'レ',
    mainlandName: '豎提',
    category: 'compound',
    objectName: '牙刷',
    image: 'zhiti-yashua.webp',
    material: '塑膠',
    stage: 2,
    examples: ['比', '氏', '衣'],
    hint: '柄直立，刷頭在下端向右上挑。',
  },
  {
    id: 'piedian',
    name: '撇點',
    shape: 'ㄑ',
    mainlandName: '撇點',
    category: 'compound',
    objectName: '回力鏢',
    image: 'piedian-huilibiao.webp',
    material: '木',
    stage: 1,
    examples: ['女', '如'],
    hint: '兩臂夾一個尖角，尖朝左。不是平滑的 C。',
  },
  {
    id: 'pieti',
    name: '撇趯',
    shape: 'ㄥ',
    mainlandName: '撇折',
    category: 'compound',
    objectName: '畚箕',
    image: 'pieti-benji.webp',
    material: '膠斗木柄',
    stage: 2,
    examples: ['去', '公'],
    hint: '先一筆長撇向左下，到底再幾乎水平向右微挑。',
  },
  {
    id: 'wangou',
    name: '彎鈎',
    shape: '㇁',
    mainlandName: '彎鈎',
    category: 'compound',
    objectName: '豆芽',
    image: 'wangou-douya.webp',
    material: '植物',
    stage: 2,
    examples: ['狗', '家', '豕'],
    hint: '像「狗」左邊那一筆：向下、肚子向右凸、下端向左鈎。',
  },
  {
    id: 'wogou',
    name: '臥鈎',
    shape: '㇃',
    mainlandName: '臥鈎',
    category: 'compound',
    objectName: '湯匙',
    image: 'wogou-tangchi.webp',
    material: '餐具',
    stage: 2,
    examples: ['心', '必'],
    hint: '躺平的湯匙，兩端都向上彎。',
  },
  {
    id: 'xiegou',
    name: '斜鈎',
    shape: '㇂',
    mainlandName: '斜鈎',
    category: 'compound',
    objectName: '高爾夫球桿',
    image: 'xiegou-gaoerfu.webp',
    material: '運動器具',
    stage: 2,
    examples: ['我', '戈'],
    hint: '長斜桿，尾端向上鈎。',
  },
];

export const STROKE_BY_ID: Record<StrokeId, StrokeDef> = Object.fromEntries(
  STROKES.map((s) => [s.id, s])
) as Record<StrokeId, StrokeDef>;

export const BASIC_STROKES = STROKES.filter((s) => s.category === 'basic');
export const COMPOUND_STROKES = STROKES.filter((s) => s.category === 'compound');

export function isStrokeId(value: unknown): value is StrokeId {
  return typeof value === 'string' && value in STROKE_BY_ID;
}

export function strokeName(id: StrokeId | null): string {
  return id ? STROKE_BY_ID[id].name : '這一筆';
}

export function objectUrl(file: string): string {
  return `${import.meta.env.BASE_URL}objects/${file}`;
}

/** 取某筆畫在指定替代擺放下的圖檔。 */
export function strokeImage(id: StrokeId, variantKey?: string): string {
  const def = STROKE_BY_ID[id];
  if (variantKey && def.variants) {
    const found = def.variants.find((v) => v.key === variantKey);
    if (found) return objectUrl(found.image);
  }
  return objectUrl(def.image);
}

/**
 * 一筆一物、一物一筆的雙向唯一檢查。開發期就要炸掉，不要等到課堂上才發現撞件。
 */
export function assertStrokeTableIntegrity(): void {
  const seenIds = new Set<string>();
  const imageOwner = new Map<string, string>();
  const objectOwner = new Map<string, string>();

  for (const s of STROKES) {
    if (seenIds.has(s.id)) {
      throw new Error(`筆畫表重複的 id：${s.id}`);
    }
    seenIds.add(s.id);

    const prevObject = objectOwner.get(s.objectName);
    if (prevObject) {
      throw new Error(`物品「${s.objectName}」同時代表 ${prevObject} 與 ${s.name}，違反一物一筆`);
    }
    objectOwner.set(s.objectName, s.name);

    for (const file of [s.image, ...(s.variants ?? []).map((v) => v.image)]) {
      const prevImage = imageOwner.get(file);
      if (prevImage && prevImage !== s.id) {
        throw new Error(`圖檔 ${file} 同時被 ${prevImage} 與 ${s.id} 使用`);
      }
      imageOwner.set(file, s.id);
    }
  }

  if (STROKES.length !== 23) {
    throw new Error(`筆畫表應有 23 件，實際 ${STROKES.length} 件`);
  }
}
