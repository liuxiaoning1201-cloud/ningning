// 設計哲學：古韻現代 - 深色夜空背景 + 金色星辰點綴

export interface CelestialBody {
  id: string;
  name: string;
  chineseName: string;
  symbol: string;
  description: string;
  details: string[];
  historicalQuote?: string;
  color: string;
}

export interface FourSymbol {
  id: string;
  name: string;
  chineseName: string;
  direction: string;
  element: string;
  color: string;
  description: string;
  details: string[];
  modernExamples?: string[];
}

export interface Mansion {
  id: string;
  name: string;
  chineseName: string;
  symbol: string;
  direction: string;
  description: string;
}

export interface Chapter {
  id: string;
  title: string;
  chineseTitle: string;
  description: string;
  icon: string;
  color: string;
}

// 七曜與五星數據
export const celestialBodies: CelestialBody[] = [
  {
    id: 'sun',
    name: 'Sun',
    chineseName: '日',
    symbol: '☉',
    description: '太陽是古代天文觀測的重要對象，代表光明和熱力。',
    details: [
      '古人稱太陽為「日」或「太陽星」',
      '太陽的運行軌跡稱為「黃道」',
      '古代以太陽的位置判斷季節變化',
      '太陽象徵皇帝的權力和統治'
    ],
    historicalQuote: '「日為陽之精，主生長」— 《黃帝內經》',
    color: '#FFD700'
  },
  {
    id: 'moon',
    name: 'Moon',
    chineseName: '月',
    symbol: '☽',
    description: '月球是古代重要的時間計量工具，代表陰柔和變化。',
    details: [
      '古人稱月球為「月」或「太陰星」',
      '月球的圓缺變化用於制定農曆',
      '月球的運行軌跡稱為「白道」',
      '月球象徵皇后和陰性力量'
    ],
    historicalQuote: '「月為陰之精，主收藏」— 《黃帝內經》',
    color: '#E0E0E0'
  },
  {
    id: 'mercury',
    name: 'Mercury',
    chineseName: '水星',
    symbol: '☿',
    description: '水星是古代五星之一，代表智慧和變化。',
    details: [
      '古人稱水星為「辰星」或「水星」',
      '水星是距離太陽最近的行星',
      '水星象徵智慧、溝通和商業',
      '水星在古代天文預測中具有重要地位'
    ],
    color: '#87CEEB'
  },
  {
    id: 'venus',
    name: 'Venus',
    chineseName: '金星',
    symbol: '♀',
    description: '金星是古代五星之一，代表美麗和愛情。',
    details: [
      '古人稱金星為「太白星」或「金星」',
      '金星是天空中最亮的星體之一',
      '金星象徵美麗、愛情和繁榮',
      '古人通過金星的位置預測吉凶'
    ],
    color: '#FFD700'
  },
  {
    id: 'mars',
    name: 'Mars',
    chineseName: '火星',
    symbol: '♂',
    description: '火星是古代五星之一，代表戰爭和熱情。',
    details: [
      '古人稱火星為「熒惑星」或「火星」',
      '火星呈現紅色，象徵戰爭和災難',
      '火星的出現被認為是不祥之兆',
      '古人認為火星主宰戰爭和動亂'
    ],
    color: '#FF4500'
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    chineseName: '木星',
    symbol: '♃',
    description: '木星是古代五星之一，代表吉祥和繁榮。',
    details: [
      '古人稱木星為「歲星」或「木星」',
      '木星是肉眼可見的最大行星',
      '木星象徵吉祥、繁榮和福氣',
      '古人通過木星的位置預測豐收'
    ],
    color: '#DAA520'
  },
  {
    id: 'saturn',
    name: 'Saturn',
    chineseName: '土星',
    symbol: '♄',
    description: '土星是古代五星之一，代表穩定和秩序。',
    details: [
      '古人稱土星為「鎮星」或「土星」',
      '土星是古代已知的最遠行星',
      '土星象徵穩定、秩序和約束',
      '古人認為土星主宰農業和收穫'
    ],
    color: '#D4A574'
  }
];

// 四象與四靈數據
export const fourSymbols: FourSymbol[] = [
  {
    id: 'azure-dragon',
    name: 'Azure Dragon',
    chineseName: '青龍',
    direction: '東方',
    element: '木',
    color: '#00AA00',
    description: '東方的守護神獸，代表春季和生長。',
    details: [
      '青龍對應東方和春季',
      '青龍象徵生長、活力和新生',
      '青龍的顏色是青色或綠色',
      '青龍在古代被視為吉祥的象徵',
      '青龍的形象常見於建築和藝術中'
    ],
    modernExamples: ['春天的萬物生長', '東方的日出', '新的開始']
  },
  {
    id: 'white-tiger',
    name: 'White Tiger',
    chineseName: '白虎',
    direction: '西方',
    element: '金',
    color: '#FFFFFF',
    description: '西方的守護神獸，代表秋季和肅殺。',
    details: [
      '白虎對應西方和秋季',
      '白虎象徵力量、威嚴和保護',
      '白虎的顏色是白色或金色',
      '白虎在古代被視為戰爭之神',
      '白虎的形象常見於軍事和防禦中'
    ],
    modernExamples: ['秋天的蕭瑟', '西方的日落', '結束與變化']
  },
  {
    id: 'vermillion-bird',
    name: 'Vermillion Bird',
    chineseName: '朱雀',
    direction: '南方',
    element: '火',
    color: '#FF0000',
    description: '南方的守護神獸，代表夏季和炎熱。',
    details: [
      '朱雀對應南方和夏季',
      '朱雀象徵光明、熱情和重生',
      '朱雀的顏色是紅色或朱紅色',
      '朱雀在古代被視為吉祥之鳥',
      '朱雀的形象常見於皇家和宗教中'
    ],
    modernExamples: ['夏天的炎熱', '南方的溫暖', '光明與希望']
  },
  {
    id: 'black-tortoise',
    name: 'Black Tortoise',
    chineseName: '玄武',
    direction: '北方',
    element: '水',
    color: '#000000',
    description: '北方的守護神獸，代表冬季和寒冷。',
    details: [
      '玄武對應北方和冬季',
      '玄武象徵智慧、深沉和保護',
      '玄武的顏色是黑色或深藍色',
      '玄武在古代被視為長壽之神',
      '玄武的形象常見於風水和建築中'
    ],
    modernExamples: ['冬天的寒冷', '北方的黑夜', '智慧與沉靜']
  }
];

// 二十八星宿數據
export const mansions: Mansion[] = [
  // 東方青龍七宿 Azure Dragon (East)
  { id: 'jiao', name: 'Horn', chineseName: '角（jiǎo）', symbol: '🐉', direction: '東方', description: '東方青龍第一宿' },
  { id: 'kang', name: 'Neck', chineseName: '亢（kàng）', symbol: '🐉', direction: '東方', description: '東方青龍第二宿' },
  { id: 'di', name: 'Root', chineseName: '氐（dī）', symbol: '🐉', direction: '東方', description: '東方青龍第三宿' },
  { id: 'fang', name: 'Room', chineseName: '房（fáng）', symbol: '🐉', direction: '東方', description: '東方青龍第四宿' },
  { id: 'xin', name: 'Heart', chineseName: '心（xīn）', symbol: '🐉', direction: '東方', description: '東方青龍第五宿' },
  { id: 'wei', name: 'Tail', chineseName: '尾（wěi）', symbol: '🐉', direction: '東方', description: '東方青龍第六宿' },
  { id: 'ji', name: 'Winnowing-basket', chineseName: '箕（jī）', symbol: '🐉', direction: '東方', description: '東方青龍第七宿' },
  // 北方玄武七宿 Murky Warrior (North)
  { id: 'dou', name: 'Dipper', chineseName: '斗（dǒu）', symbol: '🐢', direction: '北方', description: '北方玄武第一宿' },
  { id: 'niu', name: 'Ox', chineseName: '牛（niú）', symbol: '🐢', direction: '北方', description: '北方玄武第二宿' },
  { id: 'nv', name: 'Girl', chineseName: '女（nǚ）', symbol: '🐢', direction: '北方', description: '北方玄武第三宿' },
  { id: 'xu', name: 'Emptiness', chineseName: '虛（xū）', symbol: '🐢', direction: '北方', description: '北方玄武第四宿' },
  { id: 'wei2', name: 'Rooftop', chineseName: '危（wēi）', symbol: '🐢', direction: '北方', description: '北方玄武第五宿' },
  { id: 'shi', name: 'Encampment', chineseName: '室（shì）', symbol: '🐢', direction: '北方', description: '北方玄武第六宿' },
  { id: 'bi', name: 'Wall', chineseName: '壁（bì）', symbol: '🐢', direction: '北方', description: '北方玄武第七宿' },
  // 西方白虎七宿 White Tiger (West)
  { id: 'kui', name: 'Legs', chineseName: '奎（kuí）', symbol: '🐯', direction: '西方', description: '西方白虎第一宿' },
  { id: 'lou', name: 'Bond', chineseName: '婁（lóu）', symbol: '🐯', direction: '西方', description: '西方白虎第二宿' },
  { id: 'wei3', name: 'Stomach', chineseName: '胃（wèi）', symbol: '🐯', direction: '西方', description: '西方白虎第三宿' },
  { id: 'mao', name: 'Hairy head', chineseName: '昴（mǎo）', symbol: '🐯', direction: '西方', description: '西方白虎第四宿' },
  { id: 'bi2', name: 'Net', chineseName: '畢（bì）', symbol: '🐯', direction: '西方', description: '西方白虎第五宿' },
  { id: 'zui', name: 'Turtle beak', chineseName: '觜（zī）', symbol: '🐯', direction: '西方', description: '西方白虎第六宿' },
  { id: 'shen', name: 'Three stars', chineseName: '參（shēn）', symbol: '🐯', direction: '西方', description: '西方白虎第七宿' },
  // 南方朱雀七宿 Vermilion Bird (South)
  { id: 'jing', name: 'Well', chineseName: '井（jǐng）', symbol: '🐦', direction: '南方', description: '南方朱雀第一宿' },
  { id: 'gui', name: 'Ghosts', chineseName: '鬼（guǐ）', symbol: '🐦', direction: '南方', description: '南方朱雀第二宿' },
  { id: 'liu', name: 'Willow', chineseName: '柳（liǔ）', symbol: '🐦', direction: '南方', description: '南方朱雀第三宿' },
  { id: 'xing', name: 'Star', chineseName: '星（xīng）', symbol: '🐦', direction: '南方', description: '南方朱雀第四宿' },
  { id: 'zhang', name: 'Extended net', chineseName: '張（zhāng）', symbol: '🐦', direction: '南方', description: '南方朱雀第五宿' },
  { id: 'yi', name: 'Wings', chineseName: '翼（yì）', symbol: '🐦', direction: '南方', description: '南方朱雀第六宿' },
  { id: 'zhen', name: 'Chariot', chineseName: '軫（zhěn）', symbol: '🐦', direction: '南方', description: '南方朱雀第七宿' }
];

// 章節數據
export const chapters: Chapter[] = [
  {
    id: 'seven-celestial',
    title: 'Seven Celestial Bodies and Five Planets',
    chineseTitle: '七曜與五星',
    description: '探索古代天文中的七曜（日月五星）和五行的對應關係。',
    icon: '⭐',
    color: '#FFD700'
  },
  {
    id: 'four-symbols',
    title: 'Four Symbols and Four Spirits',
    chineseTitle: '四象與四靈',
    description: '了解東西南北四方的守護神獸及其文化意義。',
    icon: '🐉',
    color: '#00AA00'
  },
  {
    id: 'twenty-eight-mansions',
    title: 'Twenty-Eight Mansions',
    chineseTitle: '二十八星宿',
    description: '深入學習中國古代的二十八星宿體系及其黃道分佈。',
    icon: '🌟',
    color: '#FF6B6B'
  },
  {
    id: 'big-dipper',
    title: 'Big Dipper and Seasons',
    chineseTitle: '北斗七星與季節',
    description: '探索北斗七星如何指示季節變化和時間流轉。',
    icon: '🌌',
    color: '#4169E1'
  },
  {
    id: 'classroom-tasks',
    title: 'Classroom Tasks',
    chineseTitle: '課堂任務',
    description: '通過實踐活動深化對古代天文知識的理解。',
    icon: '✏️',
    color: '#FF8C00'
  },
  {
    id: 'twelve-zodiac',
    title: 'Twelve Zodiac Divisions',
    chineseTitle: '十二星次',
    description: '學習黃道十二宮及其與二十八星宿的對應關係。',
    icon: '♈',
    color: '#20B2AA'
  },
  {
    id: 'three-enclosures',
    title: '三垣',
    chineseTitle: '三垣',
    description: '古代天文分區系統中最高級的分類',
    icon: '🏯',
    color: '#d4af37'
  },
  {
    id: 'celestial-mythology',
    title: '星空神話',
    chineseTitle: '星空神話',
    description: '星辰背後的故事和文化意義',
    icon: '📖',
    color: '#d4af37'
  }
];

// 十二星次數據
export interface ZodiacMansion {
  id: string;
  name: string;
  pinyin: string;
  earthlyBranch: string;
  mansions: string[];
  startingJieqi: string;
  modernConstellation: string;
  symbol: string;
  description: string;
}


// 十二星次數據

// 十二星次數據
export const zodiacMansions: ZodiacMansion[] = [
  {
    id: 'xingji',
    name: '星紀',
    pinyin: 'xīngjì',
    earthlyBranch: '丑',
    mansions: ['斗', '牛', '女（前）'],
    startingJieqi: '大雪',
    modernConstellation: '摩羯座',
    symbol: '北方玄武',
    description: '星紀是十二星次的起始，代表著新的開始和循環。'
  },
  {
    id: 'xuanxiao',
    name: '玄枵',
    pinyin: 'xuánxiāo',
    earthlyBranch: '子',
    mansions: ['女（後）', '虛', '危'],
    startingJieqi: '小寒',
    modernConstellation: '水瓶座',
    symbol: '北方玄武',
    description: '玄枵象徵著寒冷和靜謐，是冬季的深處。'
  },
  {
    id: 'juzi',
    name: '娵訾',
    pinyin: 'jūzī',
    earthlyBranch: '亥',
    mansions: ['室', '壁'],
    startingJieqi: '立春',
    modernConstellation: '雙魚座',
    symbol: '北方玄武',
    description: '娵訾標誌著春天的到來，萬物開始甦醒。'
  },
  {
    id: 'jiangloiu',
    name: '降婁',
    pinyin: 'jiànglóu',
    earthlyBranch: '戌',
    mansions: ['奎', '婁'],
    startingJieqi: '驚蟄',
    modernConstellation: '白羊座',
    symbol: '西方白虎',
    description: '降婁代表著春天的深入，生命力逐漸增強。'
  },
  {
    id: 'daliang',
    name: '大梁',
    pinyin: 'dàliáng',
    earthlyBranch: '酉',
    mansions: ['胃', '昴', '畢'],
    startingJieqi: '清明',
    modernConstellation: '金牛座',
    symbol: '西方白虎',
    description: '大梁象徵著春天的繁榮，萬物欣欣向榮。'
  },
  {
    id: 'shishen',
    name: '實沈',
    pinyin: 'shí chén',
    earthlyBranch: '申',
    mansions: ['觜', '參'],
    startingJieqi: '立夏',
    modernConstellation: '雙子座',
    symbol: '西方白虎',
    description: '實沈標誌著夏季的開始，陽氣達到高峰。'
  },
  {
    id: 'chunshou',
    name: '鶉首',
    pinyin: 'chúnshǒu',
    earthlyBranch: '未',
    mansions: ['井', '鬼'],
    startingJieqi: '芒種',
    modernConstellation: '巨蟹座',
    symbol: '南方朱雀',
    description: '鶉首代表著夏季的中期，炎熱逐漸加強。'
  },
  {
    id: 'chunhuo',
    name: '鶉火',
    pinyin: 'chúnhuǒ',
    earthlyBranch: '午',
    mansions: ['柳', '星', '張'],
    startingJieqi: '小暑',
    modernConstellation: '獅子座',
    symbol: '南方朱雀',
    description: '鶉火象徵著夏季的高溫，是一年中最熱的時期。'
  },
  {
    id: 'chunwei',
    name: '鶉尾',
    pinyin: 'chúnwěi',
    earthlyBranch: '巳',
    mansions: ['翼', '軫'],
    startingJieqi: '立秋',
    modernConstellation: '處女座',
    symbol: '南方朱雀',
    description: '鶉尾標誌著夏季的結束，秋季的開始。'
  },
  {
    id: 'shouxing',
    name: '壽星',
    pinyin: 'shòuxīng',
    earthlyBranch: '辰',
    mansions: ['角', '亢'],
    startingJieqi: '白露',
    modernConstellation: '天秤座',
    symbol: '東方青龍',
    description: '壽星代表著長壽和福祉，秋季的涼爽帶來舒適。'
  },
  {
    id: 'dahuo',
    name: '大火',
    pinyin: 'dàhuǒ',
    earthlyBranch: '卯',
    mansions: ['氐', '房', '心'],
    startingJieqi: '寒露',
    modernConstellation: '天蠍座',
    symbol: '東方青龍',
    description: '大火象徵著秋季的深入，天氣逐漸轉涼。'
  },
  {
    id: 'ximu',
    name: '析木',
    pinyin: 'xīmù',
    earthlyBranch: '寅',
    mansions: ['尾', '箕'],
    startingJieqi: '立冬',
    modernConstellation: '射手座',
    symbol: '東方青龍',
    description: '析木標誌著冬季的開始，一年的循環即將完成。'
  }
];




// 天文基礎知識數據
export interface AstronomyBasic {
  id: string;
  title: string;
  chineseTitle: string;
  description: string;
  details: string[];
  historicalContext?: string;
}

export const astronomyBasics: AstronomyBasic[] = [
  {
    id: 'ecliptic',
    title: 'Ecliptic',
    chineseTitle: '黃道',
    description: '太陽在天球上運行的路徑，是古代天文觀測的重要參考線。',
    details: [
      '黃道是太陽在天球上一年運行的軌跡',
      '黃道與天赤道成約23.5度的傾角',
      '黃道被分為12個星座，對應12個月份',
      '古人通過觀測太陽在黃道上的位置來確定季節',
      '黃道與月球軌道（白道）的交點稱為「龍頭」和「龍尾」'
    ],
    historicalContext: '古代中國天文學家通過長期觀測，發現太陽在天球上的運行規律，建立了黃道系統。'
  },
  {
    id: 'three-enclosures',
    title: 'Three Enclosures',
    chineseTitle: '三垣',
    description: '古代中國天文中的三個主要天區，分別是紫微垣、太微垣和天市垣。',
    details: [
      '紫微垣：北天極周圍的天區，象徵皇帝的宮殿',
      '太微垣：紫微垣南方的天區，象徵朝代的政治中心',
      '天市垣：太微垣南方的天區，象徵人間的市場',
      '三垣共包含約300多顆星',
      '三垣體系是中國古代最重要的星官分類方法'
    ],
    historicalContext: '三垣體系在中國古代天文學中占有重要地位，反映了古人對宇宙的理解和對社會秩序的認識。'
  },
  {
    id: 'celestial-equator',
    title: 'Celestial Equator',
    chineseTitle: '天赤道',
    description: '地球赤道在天球上的投影，是天球坐標系的基準線。',
    details: [
      '天赤道將天球分為北半球和南半球',
      '天赤道與黃道的夾角約為23.5度',
      '天赤道與黃道的交點稱為春分點和秋分點',
      '古人通過觀測天赤道上的星體來確定方向',
      '天赤道是古代天文觀測的重要參考線'
    ],
    historicalContext: '古代天文學家利用天赤道建立了天球坐標系，使得星體位置的記錄和預測成為可能。'
  },
  {
    id: 'north-star',
    title: 'North Star',
    chineseTitle: '北極星',
    description: '位於北天極附近的星體，是古代導航和時間測量的重要工具。',
    details: [
      '北極星位於小熊座，距離北天極約1度',
      '北極星在夜空中幾乎不動，可用於確定北方',
      '古代船舶和陸地旅行者依靠北極星導航',
      '北極星的高度角等於觀測地的地理緯度',
      '北極星在古代被視為天帝的象徵'
    ],
    historicalContext: '北極星在中國古代天文和導航中具有極其重要的地位，被稱為「紫微星」或「天極星」。'
  }
];


// 二十八星宿別名（用於向後兼容）
export const twentyEightMansions = mansions;

// 北斗七星數據
export interface BigDipperStar {
  id: string;
  name: string;
  pinyin: string;
  meaning: string;
  position: string;
  description: string;
}

export const bigDipperStars: BigDipperStar[] = [
  {
    id: 'tianshu',
    name: '天樞',
    pinyin: 'tiānshū',
    meaning: '天樞',
    position: '北斗第一星',
    description: '北斗七星中最亮的星，位於北斗的前端，指向北方。'
  },
  {
    id: 'tianxuan',
    name: '天璇',
    pinyin: 'tiānxuán',
    meaning: '天璇',
    position: '北斗第二星',
    description: '北斗的第二顆星，與天樞一起形成北斗的「斗口」。'
  },
  {
    id: 'tianji',
    name: '天璣',
    pinyin: 'tiānjī',
    meaning: '天璣',
    position: '北斗第三星',
    description: '北斗的第三顆星，是北斗的轉折點。'
  },
  {
    id: 'tianquan',
    name: '天權',
    pinyin: 'tiānquán',
    meaning: '天權',
    position: '北斗第四星',
    description: '北斗的第四顆星，開始形成北斗的「斗柄」。'
  },
  {
    id: 'yuheng',
    name: '玉衡',
    pinyin: 'yùhéng',
    meaning: '玉衡',
    position: '北斗第五星',
    description: '北斗的第五顆星，是北斗柄的開始。'
  },
  {
    id: 'kaiyangzhu',
    name: '開陽',
    pinyin: 'kāiyáng',
    meaning: '開陽',
    position: '北斗第六星',
    description: '北斗的第六顆星，位於北斗柄的中部。'
  },
  {
    id: 'yaoguang',
    name: '瑤光',
    pinyin: 'yáoguāng',
    meaning: '瑤光',
    position: '北斗第七星',
    description: '北斗的第七顆星，是北斗柄的末端，也稱為「搖光」。'
  }
];


// 二十八星宿詳細數據（包括拼音和故事）
export interface MansionDetail {
  id: string;
  name: string;
  pinyin: string;
  meaning: string;
  description: string;
  story: string;
  direction: string;
  symbol: string;
}

export const mansionDetails: MansionDetail[] = [
  {
    id: 'jiao',
    name: '角',
    pinyin: 'jiǎo',
    meaning: '角宿',
    description: '東方青龍的第一宿，象徵新的開始和上升。古人認為角宿主宰春季的開始，預示著萬物生長。',
    story: '角宿在古代被視為龍的角，代表龍的力量和威嚴。',
    direction: '東方',
    symbol: '♈'
  },
  {
    id: 'kang',
    name: '亢',
    pinyin: 'kàng',
    meaning: '亢宿',
    description: '東方青龍的第二宿，象徵上升和進步。亢宿主宰春季的進展，預示著事物的發展。',
    story: '亢宿代表龍的頸部，象徵龍的高昂姿態和力量的展現。',
    direction: '東方',
    symbol: '♈'
  },
  {
    id: 'di',
    name: '氐',
    pinyin: 'dī',
    meaning: '氐宿',
    description: '東方青龍的第三宿，象徵基礎和穩定。氐宿主宰春季的基礎，預示著事物的根基。',
    story: '氐宿代表龍的根部，象徵龍的穩定和力量的基礎。',
    direction: '東方',
    symbol: '♈'
  },
  {
    id: 'fang',
    name: '房',
    pinyin: 'fáng',
    meaning: '房宿',
    description: '東方青龍的第四宿，象徵家庭和居所。房宿主宰春季的家庭事務，預示著家庭的和諧。',
    story: '房宿代表龍的胸部，象徵龍的心臟和溫暖。',
    direction: '東方',
    symbol: '♈'
  },
  {
    id: 'xin',
    name: '心',
    pinyin: 'xīn',
    meaning: '心宿',
    description: '東方青龍的第五宿，象徵中心和核心。心宿主宰春季的中心事務，預示著事物的核心。',
    story: '心宿代表龍的心臟，象徵龍的生命力和感情。在古代被認為是最重要的星宿之一。',
    direction: '東方',
    symbol: '♈'
  },
  {
    id: 'wei',
    name: '尾',
    pinyin: 'wěi',
    meaning: '尾宿',
    description: '東方青龍的第六宿，象徵結尾和完成。尾宿主宰春季的結尾，預示著事物的完成。',
    story: '尾宿代表龍的尾部，象徵龍的力量的延伸和事物的結束。',
    direction: '東方',
    symbol: '♈'
  },
  {
    id: 'ji',
    name: '箕',
    pinyin: 'jī',
    meaning: '箕宿',
    description: '東方青龍的第七宿，象徵風和變化。箕宿主宰春季的變化，預示著季節的轉換。',
    story: '箕宿代表龍的糞箕，象徵風的力量和事物的變化。',
    direction: '東方',
    symbol: '♈'
  },
  {
    id: 'dou',
    name: '斗',
    pinyin: 'dǒu',
    meaning: '斗宿',
    description: '北方玄武的第一宿，又名南斗，即觀星者常說的茶壼的柄和蓋部份。斗宿主宰冬季的開始，象徵方向和指引。',
    story: '中國人一向有「南斗注生，北斗注死」的說法。三國時魏國術士管輅見顏超有早夭相，教他備酒肉於卯日往桑樹下，見兩人下棋只管侍候。北坐者為北斗，南坐者為南斗。南斗取文書將顏超的十九歲改為九十歲，顏超遂得延壽。南斗星君廟主延壽度人。',
    direction: '北方',
    symbol: '♑'
  },
  {
    id: 'niu',
    name: '牛',
    pinyin: 'niú',
    meaning: '牛宿',
    description: '北方玄武的第二宿。河鼓又名牽牛，河鼓二（天鷹座α星）便是著名的牛郎星，河鼓一和三則是牛郎肩挑著的兩個孩子。',
    story: '織女為天帝孫女（天孫），負織造雲錦之責。自嫁與河西牛郎後，織乃中斷，天帝大怒，責令與牛郎分離，只准每年七夕相會一次。烏鵲於天河上會為之搭橋，名為鵲橋。',
    direction: '北方',
    symbol: '♑'
  },
  {
    id: 'nv',
    name: '女',
    pinyin: 'nǚ',
    meaning: '女宿',
    description: '北方玄武的第三宿，對應織女星。女宿主宰冬季的柔和，象徵愛情與相思。',
    story: '織女與牛郎的傳說初見於《古詩十九首》，至《荊楚歲時記》時內容已有所發展。《風俗通義》記牛郎織女相會時，烏鵲於天河上搭鵲橋。',
    direction: '北方',
    symbol: '♑'
  },
  {
    id: 'xu',
    name: '虛',
    pinyin: 'xū',
    meaning: '虛宿',
    description: '北方玄武的第四宿，象徵空虛和虛無。虛宿主宰冬季的寧靜，預示著內心的平靜。',
    story: '虛宿象徵空虛和寧靜，代表冬季的沉默和思考。',
    direction: '北方',
    symbol: '♑'
  },
  {
    id: 'wei2',
    name: '危',
    pinyin: 'wēi',
    meaning: '危宿',
    description: '北方玄武的第五宿，象徵危險和變化。危宿主宰冬季的危險，預示著需要謹慎。',
    story: '危宿象徵危險和警告，提醒人們在冬季需要謹慎。',
    direction: '北方',
    symbol: '♑'
  },
  {
    id: 'shi',
    name: '室',
    pinyin: 'shì',
    meaning: '室宿',
    description: '北方玄武的第六宿，象徵房屋和居所。室宿主宰冬季的居所，預示著家庭的溫暖。',
    story: '室宿代表房屋，象徵冬季人們回到家中尋求溫暖。',
    direction: '北方',
    symbol: '♑'
  },
  {
    id: 'bi',
    name: '壁',
    pinyin: 'bì',
    meaning: '壁宿',
    description: '北方玄武的第七宿，象徵牆壁和保護。壁宿主宰冬季的保護，預示著安全和庇護。',
    story: '壁宿代表牆壁，象徵冬季的保護和安全。',
    direction: '北方',
    symbol: '♑'
  },
  {
    id: 'kui',
    name: '奎',
    pinyin: 'kuí',
    meaning: '奎宿',
    description: '西方白虎的第一宿，象徵門和入口。奎宿主宰秋季的開始，預示著新的階段。',
    story: '奎宿代表門，象徵秋季的開始和新的機會。',
    direction: '西方',
    symbol: '♉'
  },
  {
    id: 'lou',
    name: '婁',
    pinyin: 'lóu',
    meaning: '婁宿',
    description: '西方白虎的第二宿，象徵市場和商業。婁宿主宰秋季的商業，預示著交易和繁榮。',
    story: '婁宿代表市場，象徵秋季的豐收和商業活動。',
    direction: '西方',
    symbol: '♉'
  },
  {
    id: 'wei3',
    name: '胃',
    pinyin: 'wèi',
    meaning: '胃宿',
    description: '西方白虎的第三宿，象徵消化和吸收。胃宿主宰秋季的收穫，預示著豐收的到來。',
    story: '胃宿代表胃，象徵秋季的收穫和營養的吸收。',
    direction: '西方',
    symbol: '♉'
  },
  {
    id: 'mao',
    name: '昴',
    pinyin: 'mǎo',
    meaning: '昴宿',
    description: '西方白虎的第四宿，象徵高昂和上升。昴宿主宰秋季的高昂，預示著事物的發展。',
    story: '昴宿象徵高昂和力量，代表秋季的活力。昴宿對應西方星空的昴星團（七姊妹星團）。',
    direction: '西方',
    symbol: '♉'
  },
  {
    id: 'bi2',
    name: '畢',
    pinyin: 'bì',
    meaning: '畢宿',
    description: '西方白虎的第五宿，象徵結束和完成。畢宿主宰秋季的結束，預示著事物的完成。',
    story: '畢宿象徵結束，代表秋季的收尾和準備。',
    direction: '西方',
    symbol: '♉'
  },
  {
    id: 'zui',
    name: '觜',
    pinyin: 'zī',
    meaning: '觜宿',
    description: '西方白虎的第六宿，象徵嘴巴和言語。觜宿主宰秋季的言語，預示著溝通的重要性。',
    story: '觜宿代表嘴巴，象徵秋季的言語和溝通。',
    direction: '西方',
    symbol: '♉'
  },
  {
    id: 'shen',
    name: '參',
    pinyin: 'shēn',
    meaning: '參宿',
    description: '西方白虎的第七宿，象徵三和平衡。參宿主宰秋季的平衡，預示著和諧的到來。',
    story: '參宿象徵三和平衡，代表秋季的穩定和和諧。',
    direction: '西方',
    symbol: '♉'
  },
  {
    id: 'jing',
    name: '井',
    pinyin: 'jǐng',
    meaning: '井宿',
    description: '南方朱雀的第一宿，象徵水井和水源。井宿主宰夏季的開始，預示著生命的源泉。',
    story: '井宿代表水井，象徵夏季的水源和生命的開始。',
    direction: '南方',
    symbol: '♌'
  },
  {
    id: 'gui',
    name: '鬼',
    pinyin: 'guǐ',
    meaning: '鬼宿',
    description: '南方朱雀的第二宿，象徵鬼魂和神秘。鬼宿主宰夏季的神秘，預示著未知的力量。',
    story: '鬼宿象徵神秘和未知，代表夏季的隱秘力量。',
    direction: '南方',
    symbol: '♌'
  },
  {
    id: 'liu',
    name: '柳',
    pinyin: 'liǔ',
    meaning: '柳宿',
    description: '南方朱雀的第三宿，象徵柳樹和柔和。柳宿主宰夏季的柔和，預示著溫柔的力量。',
    story: '柳宿代表柳樹，象徵夏季的柔和和優雅。',
    direction: '南方',
    symbol: '♌'
  },
  {
    id: 'xing',
    name: '星',
    pinyin: 'xīng',
    meaning: '星宿',
    description: '南方朱雀的第四宿，象徵星星和光芒。星宿主宰夏季的光芒，預示著希望的照亮。',
    story: '星宿代表星星，象徵夏季的光芒和希望。',
    direction: '南方',
    symbol: '♌'
  },
  {
    id: 'zhang',
    name: '張',
    pinyin: 'zhāng',
    meaning: '張宿',
    description: '南方朱雀的第五宿，象徵張開和展開。張宿主宰夏季的展開，預示著事物的擴展。',
    story: '張宿象徵張開，代表夏季的展開和擴展。',
    direction: '南方',
    symbol: '♌'
  },
  {
    id: 'yi',
    name: '翼',
    pinyin: 'yì',
    meaning: '翼宿',
    description: '南方朱雀的第六宿，象徵翅膀和飛翔。翼宿主宰夏季的飛翔，預示著自由和上升。',
    story: '翼宿代表翅膀，象徵夏季的飛翔和自由。',
    direction: '南方',
    symbol: '♌'
  },
  {
    id: 'zhen',
    name: '軫',
    pinyin: 'zhěn',
    meaning: '軫宿',
    description: '南方朱雀的第七宿，象徵車輪和循環。軫宿主宰夏季的循環，預示著事物的迴圈。',
    story: '軫宿代表車輪，象徵夏季的循環和完成。',
    direction: '南方',
    symbol: '♌'
  },
];


// 三垣知識數據
export interface Enclosure {
  id: string;
  name: string;
  pinyin: string;
  meaning: string;
  description: string;
  location: string;
  mainStars: string[];
  significance: string;
  mythology: string;
}

export const threeEnclosures: Enclosure[] = [
  {
    id: 'ziwei',
    name: '紫微垣',
    pinyin: 'zǐwēi yuàn',
    meaning: '紫微垣',
    description: '紫微垣位於北天極周圍，是三垣中最重要的一個。紫微星居於中天不動，象徵天帝的居所。紫微垣包含了許多重要的星官，代表了天上的皇帝和官員。',
    location: '北天極周圍',
    mainStars: ['紫微星', '天樞', '天璇', '天璣', '天權'],
    significance: '象徵皇帝的宮殿，代表天帝的權力和統治。紫禁城的名字就源於紫微星垣。',
    mythology: '紫微星是天帝的象徵，居於中天不動。古人認為皇帝是天帝在人間的代表，因此皇帝的住處被稱為紫禁城。'
  },
  {
    id: 'taiwei',
    name: '太微垣',
    pinyin: 'tàiwēi yuàn',
    meaning: '太微垣',
    description: '太微垣位於紫微垣南方，象徵朝代的政治中心。太微垣包含了五帝座和許多官員星官，代表了人間的朝代和官員。',
    location: '紫微垣南方',
    mainStars: ['五帝座', '左執法', '右執法', '天相'],
    significance: '象徵朝代的政治中心和官員的所在。太微垣的星象變化被認為預示著朝代的興衰。',
    mythology: '太微垣代表人間的朝代和官員，是天上的政治中心。古人通過觀察太微垣的星象變化來預測朝代的未來。'
  },
  {
    id: 'tianshi',
    name: '天市垣',
    pinyin: 'tiānshì yuàn',
    meaning: '天市垣',
    description: '天市垣位於太微垣南方，象徵人間的市場和商業活動。天市垣包含了許多商業相關的星官，代表了人間的市場和交易。',
    location: '太微垣南方',
    mainStars: ['天市星', '天紀', '天廩', '天鼓'],
    significance: '象徵人間的市場和商業活動。天市垣的星象變化被認為預示著商業的繁榮和衰退。',
    mythology: '天市垣代表人間的市場，是天上的商業中心。古人通過觀察天市垣的星象變化來預測商業的未來和經濟的發展。'
  }
];



// 星空神話和故事數據
export interface CelestialMyth {
  id: string;
  title: string;
  category: string;
  content: string;
  relatedStars: string[];
  culturalSignificance: string;
}


// 星空神話和故事數據
export interface CelestialMyth {
  id: string;
  title: string;
  category: string;
  content: string;
  relatedStars: string[];
  culturalSignificance: string;
}

export const celestialMyths: CelestialMyth[] = [
  {
    id: 'cosmos-origin',
    title: '天地來源',
    category: '宇宙起源',
    content: '在中國古代的宇宙觀中，天地最初是混沌一體的。根據《淮南子》的記載，盤古在混沌中開天闢地。盤古用斧頭分開了天地，他的身體化為天地萬物：頭部化為東嶽，腳部化為西嶽，腹部化為中嶽，左臂化為南嶽，右臂化為北嶽。他的血液化為江河，肌肉化為大地，骨骼化為山脈，毛髮化為草木。盤古死後，他的左眼化為太陽，右眼化為月亮，呼吸化為風，聲音化為雷鳴。',
    relatedStars: ['太陽', '月亮', '星辰'],
    culturalSignificance: '盤古開天闢地的神話是中國古代對宇宙起源的想像，反映了古人對自然界的敬畏和對生命起源的思考。'
  },
  {
    id: 'nuwa-mends-sky',
    title: '女媧補天',
    category: '宇宙起源',
    content: '相傳天地初開之時，四方的天柱坍塌，大地裂開，導致洪水滔天、火焰蔓延。女媧為了拯救世人，用五色石補青天，斷鼇足作為新的天柱，再為世人除去為禍世間的黑龍，然後以泥土阻截洪水，天下才能回復太平。',
    relatedStars: ['五色石', '天柱'],
    culturalSignificance: '女媧補天象徵著對自然災害的克服和世界秩序的恢復，體現了古人對和諧宇宙的嚮往。'
  },
  {
    id: 'nian-beast',
    title: '年獸',
    category: '時間季節',
    content: '相傳古代有一隻怪獸，名字叫做「年」。年獸長期蟄伏在海底，一睡就是一年，要在每年最後一天的夜裡才會醒來。它上岸時，會帶起洪水，更會將遇到的所有人畜吃掉。村子裡的人都非常害怕年獸，後來得到一位神仙指點，才知道年獸最怕紅色和嘈吵，自此便有了新年的時候貼紅紙、燒爆竹的習俗。',
    relatedStars: ['年獸'],
    culturalSignificance: '年獸的故事解釋了新年習俗的來源，反映了古人對時間循環和季節變化的理解。'
  },
  {
    id: 'kuafu-chases-sun',
    title: '誇父逐日',
    category: '太陽月亮',
    content: '古代有一巨人名叫誇父，他一日突發奇想，要與太陽賽跑，走到中途，口渴難奈，竟把黃河和渭水的河水全部喝掉，可惜人力終不能勝天，終於力盡而死，他的手杖，化為一片廣達數千裡的桃林。',
    relatedStars: ['太陽', '黃河', '渭水'],
    culturalSignificance: '誇父逐日象徵了人類對自然力量的追求和挑戰，雖然最終失敗，但精神永遠被後人銘記。'
  },
  {
    id: 'houyi-shoots-sun',
    title: '後羿射日',
    category: '太陽月亮',
    content: '中國人相信，在很久很久以前，天上原本有十個太陽，但他們只會輪流在天空出現，普照世人。厭倦了日日如是的生活，太陽們竟決定一起出遊，結果大地淪為酷熱地獄，堯帝為免生靈塗炭，請求掌管天界的帝俊約束他的太陽兒子們，不許他們一起出現。太陽們對老爸的說話充耳不聞，堯唯有派遣後羿，挽神弓、搭利箭，要嚇嚇這群不知好歹的太陽，但後羿竟然不管青紅皂白，一口氣把九個太陽射了下來。兒子慘死，帝俊一怒之下把後羿貶謫凡塵。',
    relatedStars: ['太陽', '後羿'],
    culturalSignificance: '後羿射日反映了古人對太陽運行規律的認識，以及對秩序和平衡的追求。'
  },
  {
    id: 'chang-e-moon',
    title: '嫦娥奔月',
    category: '太陽月亮',
    content: '在把九個太陽射下來後，後羿和他的妻子嫦娥被貶到人間，但其實在心裡面，他倆還是念念不忘有日要重回天界。後來，聽說西王母有不死之藥，後羿便去求見。西王母很同情後羿的遭遇，便把藥給了他，並說：「這藥，你夫婦倆吃了便可以長生不死，要是一個人吃了，還能升天為神。」怎料，嫦娥知道後，有了私心，竟把所有藥都偷偷吃了，做了這等背夫之事，嫦娥亦怕受到天庭眾仙恥笑，只好奔往月亮，長住月宮，成了月神娘娘。',
    relatedStars: ['月亮', '嫦娥', '西王母'],
    culturalSignificance: '嫦娥奔月是中國古代最著名的愛情悲劇，象徵著對永恆生命的渴望和對月亮的詩意理解。'
  },
  {
    id: 'wugang-cuts-tree',
    title: '吳剛砍玉桂樹',
    category: '太陽月亮',
    content: '吳剛在月中砍桂樹的傳說很多人都知道，但吳剛是甚麼人？又為甚麼要砍桂樹？卻是眾說紛紜。其中一個故事是這樣的，話說吳剛離家學道，三年後，回家時竟發覺妻子緣婦和炎帝之孫伯陵私通，更生了三個兒下，大怒之下，去找伯陵報仇，更以極殘酷的方法把伯陵殺死。炎帝大怒，把吳剛發配月亮，命令他砍伐不死的月桂樹，月桂高達五百丈，隨砍隨合，吳剛便生生世世在月中砍樹，永不得休息。據說緣婦對丈夫的遭遇感到內疚，便命三個兒子到月上永遠陪伴他們名義上的父親，那三個其實是伯陵生的兒子鼓（蟾蜍）、殳（兔）、延（未詳）也永遠生活在月宮中了。這也是月上為甚麼有蟾蜍和玉兔的原因。',
    relatedStars: ['月亮', '玉兔', '蟾蜍'],
    culturalSignificance: '吳剛砍桂樹的故事解釋了月亮上的玉兔和蟾蜍的來源，象徵著對月亮的浪漫想像。'
  },
  {
    id: 'five-stars-legend',
    title: '五星出東方利中國',
    category: '天象預兆',
    content: '「五星出東方利中國」是著名的漢代織錦文字，發現於新疆。這句話記錄了一個罕見的天象：金、木、水、火、土五顆行星同時出現在東方天空。古人認為這是極其吉祥的天象，預示著國家的興旺和繁榮。根據歷史記載，這種現象確實發生過幾次，每次都被認為是國家即將興盛的預兆。',
    relatedStars: ['金星', '木星', '水星', '火星', '土星'],
    culturalSignificance: '五星出東方被認為是國家興旺的象徵，反映了古人對天象的觀察和對國家命運的思考。'
  },
  {
    id: 'weaver-cowherd',
    title: '織女與牛郎',
    category: '愛情故事',
    content: '織女星和牛郎星的故事是中國古代最著名的愛情神話。根據民間傳說，織女是天帝的女兒，她在天上織布。牛郎是一個凡人，他與織女相愛並結婚。但天帝不允許他們在一起，將織女帶回天上，用銀河將他們分開。每年七月初七，喜鵲會搭建一座橋樑，讓織女和牛郎能夠相聚一天。這個故事象徵著愛情的堅貞和相思的苦楚。',
    relatedStars: ['織女星', '牛郎星', '銀河'],
    culturalSignificance: '織女與牛郎的故事是中國古代最著名的愛情神話，激發了無數文人墨客的創作靈感。七夕節（乞巧節）就源於對這對星星情侶的祭祀。'
  },
  {
    id: 'jupiter-taisui',
    title: '木星與太歲',
    category: '行星神話',
    content: '中國人常說「誰敢在太歲頭上動土。」但究竟太歲是誰，恐怕不少人也不大了了，只知他是比世上一切惡魔更兇殘可怕百倍的神。原來太歲的出現和中國古代歲星（即木星）紀年有關，木星約十二年運行一周天，人們便把周天分為十二分，稱為十二次，木星每年行經一次，就用木星所在星次來紀年。由於十二地支的順序為當時人們所熟知，因此，古代中國人又設想有個天體，它的運行速度也是十二年一周天，但運行方向是和木星相反，這個假想的天體稱為太歲。自西漢開始，人們已經認為太歲每年所行經的方位是不祥的，若在太歲方位動土，就會挖出一種會動的肉塊，給人帶來災禍。',
    relatedStars: ['木星', '太歲'],
    culturalSignificance: '太歲信仰反映了古人對木星運行規律的認識，以及對時間和方位的敬畏。'
  },
  {
    id: 'venus-huangE',
    title: '金星與皇娥',
    category: '行星神話',
    content: '傳說中，天宮中有一負責織布的仙女稱為皇娥，有一天，她工作疲乏了，便駕著木筏到銀河遊玩，溯流而上到西海邊的窮桑樹下。東方的金星看見了她，故化作一位容貌超塵的少年，來到銀河邊彈琴唱歌，兩人相見下互生情愫，後來更生了一個兒子，取名叫少昊，又名窮桑氏，少昊長大後，到東方海外建立少昊之國。此外，在《西游記》中，太白金星是一位上界神仙，在孫悟空鬧東海、攪地府的時候，就是他奉玉帝之命前往招安的。',
    relatedStars: ['金星', '皇娥', '少昊'],
    culturalSignificance: '金星與皇娥的故事象徵著愛情和創造，反映了古人對金星的浪漫想像。'
  }
];



