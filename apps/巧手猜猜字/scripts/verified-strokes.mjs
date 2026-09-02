/**
 * 人工覈核過的筆畫標註：字 → 每一筆的 StrokeId。
 *
 * 這裡是「已核對」名單的單一來源。gen-char-data.mjs 會用抓回來的筆順資料驗證
 * 每個字的筆數是否吻合；不吻合就不寫入 verified，並在報告裡列出來，
 * 避免我們自己數錯筆卻讓學生照著練。
 *
 * 未列在這裡的字仍可加入字簿，但會標成「筆順待核」，筆畫種類留空，
 * 只能玩挑戰模式的位置比對，不做筆順鎖定。
 */
export const VERIFIED_STROKES = {
  // 一至三筆
  一: ['heng'],
  二: ['heng', 'heng'],
  三: ['heng', 'heng', 'heng'],
  十: ['heng', 'zhi'],
  丁: ['heng', 'zhigou'],
  卜: ['zhi', 'dian'],
  人: ['pie', 'na'],
  入: ['pie', 'na'],
  八: ['pie', 'na'],
  大: ['heng', 'pie', 'na'],
  小: ['zhigou', 'dian', 'dian'],
  上: ['zhi', 'heng', 'heng'],
  下: ['heng', 'zhi', 'dian'],
  口: ['zhi', 'hengzhi', 'heng'],
  山: ['zhi', 'zhizheng', 'zhi'],
  川: ['pie', 'zhi', 'zhi'],
  女: ['piedian', 'pie', 'heng'],
  了: ['hengpie', 'zhigou'],
  子: ['hengpie', 'zhigou', 'heng'],
  刀: ['hengzhigou', 'pie'],
  力: ['hengzhigou', 'pie'],
  又: ['hengpie', 'na'],
  夕: ['pie', 'hengpie', 'dian'],
  也: ['hengzhigou', 'zhi', 'zhiwangou'],
  工: ['heng', 'zhi', 'heng'],
  土: ['heng', 'zhi', 'heng'],
  士: ['heng', 'zhi', 'heng'],
  千: ['pie', 'heng', 'zhi'],

  // 四筆
  天: ['heng', 'heng', 'pie', 'na'],
  木: ['heng', 'zhi', 'pie', 'na'],
  日: ['zhi', 'hengzhi', 'heng', 'heng'],
  中: ['zhi', 'hengzhi', 'heng', 'zhi'],
  火: ['dian', 'pie', 'pie', 'na'],
  水: ['zhigou', 'hengpie', 'pie', 'na'],
  月: ['pie', 'hengzhigou', 'heng', 'heng'],
  手: ['pie', 'heng', 'heng', 'zhigou'],
  心: ['dian', 'wogou', 'dian', 'dian'],
  公: ['pie', 'na', 'pieti', 'dian'],
  戈: ['heng', 'xiegou', 'pie', 'dian'],
  王: ['heng', 'heng', 'zhi', 'heng'],
  牛: ['pie', 'heng', 'heng', 'zhi'],
  止: ['zhi', 'heng', 'zhi', 'heng'],
  // 子作左偏旁時，末筆的橫變成趯
  孔: ['hengpie', 'zhigou', 'ti', 'zhiwangou'],

  // 五筆及以上
  本: ['heng', 'zhi', 'pie', 'na', 'heng'],
  目: ['zhi', 'hengzhi', 'heng', 'heng', 'heng'],
  去: ['heng', 'zhi', 'heng', 'pieti', 'dian'],
  必: ['dian', 'wogou', 'pie', 'dian', 'dian'],
  主: ['dian', 'heng', 'heng', 'zhi', 'heng'],
  石: ['heng', 'pie', 'zhi', 'hengzhi', 'heng'],
  白: ['pie', 'zhi', 'hengzhi', 'heng', 'heng'],
  生: ['pie', 'heng', 'heng', 'zhi', 'heng'],
  衣: ['dian', 'heng', 'pie', 'zhiti', 'pie', 'na'],
  // 好：ZhHant 字形裡女旁末筆仍是平橫，標註跟著字卡動畫走
  好: ['piedian', 'pie', 'heng', 'hengpie', 'zhigou', 'heng'],
  // 難：第五畫是口形左邊的直，不是點（楷書略斜）
  難: ['heng', 'zhi', 'zhi', 'heng', 'zhi', 'hengzhi', 'heng', 'heng', 'heng', 'pie', 'dian', 'pie', 'zhi', 'dian', 'heng', 'heng', 'heng', 'zhi', 'heng'],
};

/**
 * 想收進遊戲、但筆畫標註還沒人工確認的字。
 * 會抓筆順資料與字卡動畫，但 strokeTypes 留空、標為待核。
 */
export const PENDING_CHARS = [
  // 第 3 筆在 ZhHant 資料裡近乎水平，與「撇」對不上，未確認前不敢當已核對
  '比',
  '我',
  '弓',
  '弟',
  '永',
  '家',
  '狗',
  '奶',
  '乃',
  '吃',
  '九',
  '亞',
  '凸',
  '門',
  '牙',
  '兒',
  '買',
  '方',
  '寸',
  '竹',
  '田',
];
