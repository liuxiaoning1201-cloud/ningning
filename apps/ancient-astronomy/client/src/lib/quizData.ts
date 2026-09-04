// 設計哲學：古韻現代 - 寓教於樂

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface Quiz {
  id: string;
  chapterName: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
}

export interface MatchingGame {
  id: string;
  chapterName: string;
  title: string;
  description: string;
  pairs: MatchingPair[];
}

// 七曜與五星測驗
export const sevenCelestialQuiz: Quiz = {
  id: 'seven-celestial-quiz',
  chapterName: '七曜與五星',
  title: '知識測驗：七曜與五星',
  description: '檢驗你對七曜與五星的理解',
  questions: [
    {
      id: 'q1',
      question: '古人把日、月和哪五顆星合稱為七曜？',
      options: [
        '金、木、水、火、土',
        '北斗、南斗、東斗、西斗、中斗',
        '啟明、長庚、熒惑、鎮星、歲星',
        '青龍、白虎、玄武、朱雀、黃龍'
      ],
      correctAnswer: 0,
      explanation: '七曜是指日、月、金、木、水、火、土七個天體，代表了古人對天空的基本認識。'
    },
    {
      id: 'q2',
      question: '金星在古代被稱為什麼？',
      options: [
        '啟明星',
        '太白星',
        '長庚星',
        '以上都對'
      ],
      correctAnswer: 3,
      explanation: '金星有多個名稱：早晨出現時稱啟明星，傍晚出現時稱長庚星，統稱太白星。'
    },
    {
      id: 'q3',
      question: '火星在古代被稱為什麼，代表什麼含義？',
      options: [
        '熒惑星，代表智慧',
        '熒惑星，代表戰爭與災難',
        '赤星，代表繁榮',
        '丹星，代表平和'
      ],
      correctAnswer: 1,
      explanation: '火星呈紅色，古人稱之為熒惑星，認為它代表戰爭、災難和混亂。'
    },
    {
      id: 'q4',
      question: '木星在古代被稱為什麼，代表什麼含義？',
      options: [
        '鎮星，代表穩定',
        '歲星，代表吉祥與豐收',
        '太歲星，代表災難',
        '帝星，代表皇帝'
      ],
      correctAnswer: 1,
      explanation: '木星古稱歲星，周期約12年，古人認為它代表吉祥、豐收和國家興旺。'
    },
    {
      id: 'q5',
      question: '土星在古代被稱為什麼？',
      options: [
        '鎮星',
        '歲星',
        '太白星',
        '熒惑星'
      ],
      correctAnswer: 0,
      explanation: '土星古稱鎮星，象徵穩定、秩序和約束，主宰農業和收穫。'
    }
  ]
};

// 四象與星宿連線遊戲
export const fourSymbolsMatching: MatchingGame = {
  id: 'four-symbols-matching',
  chapterName: '四象與四靈',
  title: '星宿連線遊戲：星宿與四象',
  description: '將星宿與其所屬的四象連線配對',
  pairs: [
    // 東方青龍（7宿）
    { id: 'p1', left: '角', right: '青龍' },
    { id: 'p2', left: '亢', right: '青龍' },
    { id: 'p3', left: '氐', right: '青龍' },
    { id: 'p4', left: '房', right: '青龍' },
    { id: 'p5', left: '心', right: '青龍' },
    { id: 'p6', left: '尾', right: '青龍' },
    { id: 'p7', left: '箕', right: '青龍' },
    // 北方玄武（7宿）
    { id: 'p8', left: '斗', right: '玄武' },
    { id: 'p9', left: '牛', right: '玄武' },
    { id: 'p10', left: '女', right: '玄武' },
    { id: 'p11', left: '虛', right: '玄武' },
    { id: 'p12', left: '危', right: '玄武' },
    { id: 'p13', left: '室', right: '玄武' },
    { id: 'p14', left: '壁', right: '玄武' },
    // 西方白虎（7宿）
    { id: 'p15', left: '奎', right: '白虎' },
    { id: 'p16', left: '婁', right: '白虎' },
    { id: 'p17', left: '胃', right: '白虎' },
    { id: 'p18', left: '昴', right: '白虎' },
    { id: 'p19', left: '畢', right: '白虎' },
    { id: 'p20', left: '觜', right: '白虎' },
    { id: 'p21', left: '參', right: '白虎' },
    // 南方朱雀（7宿）
    { id: 'p22', left: '井', right: '朱雀' },
    { id: 'p23', left: '鬼', right: '朱雀' },
    { id: 'p24', left: '柳', right: '朱雀' },
    { id: 'p25', left: '星', right: '朱雀' },
    { id: 'p26', left: '張', right: '朱雀' },
    { id: 'p27', left: '翼', right: '朱雀' },
    { id: 'p28', left: '軫', right: '朱雀' }
  ]
};

// 北斗七星測驗
export const bigDipperQuiz: Quiz = {
  id: 'big-dipper-quiz',
  chapterName: '北斗七星',
  title: '知識測驗：北斗七星',
  description: '檢驗你對北斗七星的理解',
  questions: [
    {
      id: 'q1',
      question: '北斗七星由幾顆亮星組成？',
      options: [
        '五顆',
        '六顆',
        '七顆',
        '八顆'
      ],
      correctAnswer: 2,
      explanation: '北斗七星由七顆亮星組成，形狀像一個斗。'
    },
    {
      id: 'q2',
      question: '當北斗的斗柄東指時，代表什麼季節？',
      options: [
        '春季',
        '夏季',
        '秋季',
        '冬季'
      ],
      correctAnswer: 0,
      explanation: '戰國時期《鶡冠子》記載：「斗柄東指，天下皆春」。'
    },
    {
      id: 'q3',
      question: '北極星距離天極最近，古人用它來做什麼？',
      options: [
        '計算時間',
        '確定方向',
        '預測天氣',
        '計算距離'
      ],
      correctAnswer: 1,
      explanation: '北極星幾乎不動，因此被古人用作方向指示。'
    },
    {
      id: 'q4',
      question: '北斗七星的第一顆星叫什麼？',
      options: [
        '天璇',
        '天樞',
        '天璣',
        '天權'
      ],
      correctAnswer: 1,
      explanation: '北斗七星依次為：天樞、天璇、天璣、天權、玉衡、開陽、瑤光。'
    },
    {
      id: 'q5',
      question: '北斗七星的最後一顆星叫什麼？',
      options: [
        '開陽',
        '瑤光',
        '玉衡',
        '天權'
      ],
      correctAnswer: 1,
      explanation: '瑤光是北斗七星的第七顆星，也稱為「搖光」，位於北斗柄的末端。'
    }
  ]
};

// 天文基礎測驗（已刪除，改為三垣測驗）
export const threeEnclosuresQuiz: Quiz = {
  id: 'three-enclosures-quiz',
  chapterName: '三垣',
  title: '知識測驗：三垣',
  description: '檢驗你對三垣的理解',
  questions: [
    {
      id: 'q1',
      question: '三垣分別是什麼？',
      options: [
        '紫微垣、太微垣、天市垣',
        '東垣、西垣、中垣',
        '上垣、中垣、下垣',
        '天垣、地垣、人垣'
      ],
      correctAnswer: 0,
      explanation: '三垣是古代中國天文中的三個主要天區，分別代表天帝、朝代和人間。'
    },
    {
      id: 'q2',
      question: '紫微垣象徵什麼？',
      options: [
        '人間的市場',
        '皇帝的宮殿',
        '朝代的政治中心',
        '天地的邊界'
      ],
      correctAnswer: 1,
      explanation: '紫微垣位於北天極周圍，象徵皇帝的宮殿，紫微星是天帝的象徵。'
    },
    {
      id: 'q3',
      question: '太微垣象徵什麼？',
      options: [
        '人間的市場',
        '皇帝的宮殿',
        '朝代的政治中心',
        '天地的邊界'
      ],
      correctAnswer: 2,
      explanation: '太微垣位於紫微垣南方，象徵朝代的政治中心和官員的所在。'
    },
    {
      id: 'q4',
      question: '天市垣象徵什麼？',
      options: [
        '人間的市場',
        '皇帝的宮殿',
        '朝代的政治中心',
        '天地的邊界'
      ],
      correctAnswer: 0,
      explanation: '天市垣位於太微垣南方，象徵人間的市場和商業活動。'
    },
    {
      id: 'q5',
      question: '北京的紫禁城名字源於什麼？',
      options: [
        '紫色的禁地',
        '紫微星垣',
        '紫色的城牆',
        '紫色的宮殿'
      ],
      correctAnswer: 1,
      explanation: '紫禁城的名字源於「紫微星垣」，象徵皇帝的權力受命於天。'
    }
  ]
};

// 星空神話測驗
export const celestialMythologyQuiz: Quiz = {
  id: 'celestial-mythology-quiz',
  chapterName: '星空神話',
  title: '知識測驗：星空神話',
  description: '檢驗你對星空神話的理解',
  questions: [
    {
      id: 'q1',
      question: '「五星出東方利中國」出自哪個時代？',
      options: [
        '秦代',
        '漢代',
        '唐代',
        '宋代'
      ],
      correctAnswer: 1,
      explanation: '這是著名的漢代織錦文字，預示著國家興旺和吉祥。'
    },
    {
      id: 'q2',
      question: '「熒惑守心」中的「熒惑」是指哪顆星？',
      options: [
        '金星',
        '火星',
        '木星',
        '土星'
      ],
      correctAnswer: 1,
      explanation: '熒惑是火星的古稱，代表戰爭與災難。如果停留在心宿位置會被視為對統治者的警告。'
    },
    {
      id: 'q3',
      question: '牛郎織女星的故事與哪個節日有關？',
      options: [
        '中秋節',
        '端午節',
        '七夕節',
        '元宵節'
      ],
      correctAnswer: 2,
      explanation: '七夕節（乞巧節）源於對牛郎織女星的祭祀，後來演變為女性祈求心靈手巧的節日。'
    },
    {
      id: 'q4',
      question: '三官大帝中，上元天官是誰？',
      options: [
        '舜帝',
        '堯帝',
        '禹帝',
        '黃帝'
      ],
      correctAnswer: 1,
      explanation: '上元天官紫微大帝的原型傳說為堯帝，掌管賜福，對應正月十五元宵節。'
    },
    {
      id: 'q5',
      question: '中元地官對應哪個節日？',
      options: [
        '正月十五',
        '七月十五',
        '十月十五',
        '十二月十五'
      ],
      correctAnswer: 1,
      explanation: '中元地官清虛大帝對應七月十五中元節，掌管赦罪。'
    }
  ]
};

// 二十八星宿測驗
export const twentyEightMansionsQuiz: Quiz = {
  id: 'twenty-eight-quiz',
  chapterName: '二十八星宿',
  title: '知識測驗：二十八星宿',
  description: '檢驗你對二十八星宿的理解',
  questions: [
    {
      id: 'q1',
      question: '二十八星宿分別屬於哪四個象？',
      options: [
        '五個象',
        '三個象',
        '四個象',
        '六個象'
      ],
      correctAnswer: 2,
      explanation: '二十八星宿分別屬於東方青龍、北方玄武、西方白虎、南方朱雀四個象。'
    },
    {
      id: 'q2',
      question: '東方青龍對應的七宿是？',
      options: [
        '斗、牛、女、虛、危、室、壁',
        '角、亢、氐、房、心、尾、箕',
        '奎、婁、胃、昴、畢、觜、參',
        '井、鬼、柳、星、張、翼、軫'
      ],
      correctAnswer: 1,
      explanation: '東方青龍對應春季，包括角、亢、氐、房、心、尾、箕七宿。'
    },
    {
      id: 'q3',
      question: '北方玄武對應的季節是？',
      options: [
        '春季',
        '夏季',
        '秋季',
        '冬季'
      ],
      correctAnswer: 3,
      explanation: '北方玄武對應冬季，象徵潛藏和沉靜。'
    },
    {
      id: 'q4',
      question: '西方白虎對應的季節是？',
      options: [
        '春季',
        '夏季',
        '秋季',
        '冬季'
      ],
      correctAnswer: 2,
      explanation: '西方白虎對應秋季，象徵收割和肅殺。'
    },
    {
      id: 'q5',
      question: '南方朱雀對應的季節是？',
      options: [
        '春季',
        '夏季',
        '秋季',
        '冬季'
      ],
      correctAnswer: 1,
      explanation: '南方朱雀對應夏季，象徵繁茂和光明。'
    }
  ]
};

// 十二星次測驗
export const twelveZodiacQuiz: Quiz = {
  id: 'twelve-zodiac-quiz',
  chapterName: '十二星次',
  title: '知識測驗：十二星次',
  description: '檢驗你對十二星次的理解',
  questions: [
    {
      id: 'q1',
      question: '十二星次對應西方的什麼？',
      options: [
        '十二月份',
        '十二星座',
        '十二生肖',
        '十二地支'
      ],
      correctAnswer: 1,
      explanation: '十二星次是黃道十二宮，對應西方的十二星座。'
    },
    {
      id: 'q2',
      question: '星紀是黃道十二次中的第幾次？',
      options: [
        '第一次',
        '第二次',
        '第三次',
        '第十二次'
      ],
      correctAnswer: 0,
      explanation: '星紀是黃道十二次的第一次，對應西方的摩羯座，主宰冬季的開始。'
    },
    {
      id: 'q3',
      question: '降婁對應西方的哪個星座？',
      options: [
        '金牛座',
        '白羊座',
        '雙魚座',
        '摩羯座'
      ],
      correctAnswer: 1,
      explanation: '降婁是黃道十二次的第四次，對應西方的白羊座。'
    },
    {
      id: 'q4',
      question: '大梁對應西方的哪個星座？',
      options: [
        '白羊座',
        '金牛座',
        '雙子座',
        '巨蟹座'
      ],
      correctAnswer: 1,
      explanation: '大梁是黃道十二次的第五次，對應西方的金牛座。'
    },
    {
      id: 'q5',
      question: '析木是黃道十二次中的第幾次？',
      options: [
        '第十次',
        '第十一次',
        '第十二次',
        '第一次'
      ],
      correctAnswer: 2,
      explanation: '析木是黃道十二次的第十二次，對應西方的射手座，主宰秋冬交替。'
    }
  ]
};

export const astronomyBasicsQuiz: Quiz = {
  id: 'astronomy-basics-quiz',
  chapterName: '天文基礎',
  title: '知識測驗：天文基礎',
  description: '檢驗你對天文基礎的理解',
  questions: [
    {
      id: 'q1',
      question: '黃道是什麼？',
      options: [
        '月球在天球上的運行軌跡',
        '太陽在天球上的運行軌跡',
        '地球在太陽周圍的運行軌跡',
        '北斗七星的運行軌跡'
      ],
      correctAnswer: 1,
      explanation: '黃道是太陽在天球上一年運行的軌跡，與天赤道成約23.5度的傾角。'
    },
    {
      id: 'q2',
      question: '二十四節氣是通過觀測什麼確定的？',
      options: [
        '月球的位置',
        '北斗七星的位置',
        '太陽在黃道上的位置',
        '五顆行星的位置'
      ],
      correctAnswer: 2,
      explanation: '二十四節氣是通過觀測太陽在黃道上的位置確定的，直接指導農業生產。'
    },
    {
      id: 'q3',
      question: '白道是什麼？',
      options: [
        '太陽的運行軌跡',
        '月球的運行軌跡',
        '金星的運行軌跡',
        '北斗七星的運行軌跡'
      ],
      correctAnswer: 1,
      explanation: '白道是月球在天球上的運行軌跡，與黃道的交點稱為龍頭和龍尾。'
    },
    {
      id: 'q4',
      question: '天赤道與黃道的夾角約為多少度？',
      options: [
        '15度',
        '23.5度',
        '45度',
        '90度'
      ],
      correctAnswer: 1,
      explanation: '天赤道與黃道的夾角約為23.5度，這導致了地球上季節的變化。'
    },
    {
      id: 'q5',
      question: '北極星的高度角等於什麼？',
      options: [
        '觀測地的經度',
        '觀測地的海拔',
        '觀測地的地理緯度',
        '北斗七星的高度'
      ],
      correctAnswer: 2,
      explanation: '北極星的高度角等於觀測地的地理緯度，這是古代導航的重要方法。'
    }
  ]
};

// 四象連線遊戲（已更新為正確版本）
export const twentyEightMansionsMatching = fourSymbolsMatching;

// 導出所有測驗
export const allQuizzes = [
  sevenCelestialQuiz,
  bigDipperQuiz,
  threeEnclosuresQuiz,
  celestialMythologyQuiz,
  twentyEightMansionsQuiz,
  twelveZodiacQuiz,
  astronomyBasicsQuiz
];
