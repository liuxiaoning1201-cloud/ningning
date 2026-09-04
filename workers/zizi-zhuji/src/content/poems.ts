/**
 * 五言/七言詩句庫（一句為單位，依《唐詩三百首》與小學語文教材常見篇目挑選）。
 * 用於：
 *   1. 五言 / 七言詩接龍棋盤生成（從中抽取若干句鋪到棋盤）
 *   2. complete 模式裁定（玩家連線是否命中某句詩）
 */

export interface PoemLine {
  /** 純漢字組成（含句末標點時請去除） */
  text: string;
  source: string;
  author?: string;
}

export const POEMS_5: PoemLine[] = [
  { text: "床前明月光", source: "靜夜思", author: "李白" },
  { text: "疑是地上霜", source: "靜夜思", author: "李白" },
  { text: "舉頭望明月", source: "靜夜思", author: "李白" },
  { text: "低頭思故鄉", source: "靜夜思", author: "李白" },

  { text: "白日依山盡", source: "登鸛雀樓", author: "王之渙" },
  { text: "黃河入海流", source: "登鸛雀樓", author: "王之渙" },
  { text: "欲窮千里目", source: "登鸛雀樓", author: "王之渙" },
  { text: "更上一層樓", source: "登鸛雀樓", author: "王之渙" },

  { text: "鵝鵝鵝", source: "詠鵝", author: "駱賓王" },
  { text: "曲項向天歌", source: "詠鵝", author: "駱賓王" },
  { text: "白毛浮綠水", source: "詠鵝", author: "駱賓王" },
  { text: "紅掌撥清波", source: "詠鵝", author: "駱賓王" },

  { text: "春眠不覺曉", source: "春曉", author: "孟浩然" },
  { text: "處處聞啼鳥", source: "春曉", author: "孟浩然" },
  { text: "夜來風雨聲", source: "春曉", author: "孟浩然" },
  { text: "花落知多少", source: "春曉", author: "孟浩然" },

  { text: "鋤禾日當午", source: "憫農", author: "李紳" },
  { text: "汗滴禾下土", source: "憫農", author: "李紳" },
  { text: "誰知盤中飧", source: "憫農", author: "李紳" },
  { text: "粒粒皆辛苦", source: "憫農", author: "李紳" },

  { text: "離離原上草", source: "賦得古原草送別", author: "白居易" },
  { text: "一歲一枯榮", source: "賦得古原草送別", author: "白居易" },
  { text: "野火燒不盡", source: "賦得古原草送別", author: "白居易" },
  { text: "春風吹又生", source: "賦得古原草送別", author: "白居易" },

  { text: "千山鳥飛絕", source: "江雪", author: "柳宗元" },
  { text: "萬徑人蹤滅", source: "江雪", author: "柳宗元" },
  { text: "孤舟蓑笠翁", source: "江雪", author: "柳宗元" },
  { text: "獨釣寒江雪", source: "江雪", author: "柳宗元" },

  { text: "松下問童子", source: "尋隱者不遇", author: "賈島" },
  { text: "言師採藥去", source: "尋隱者不遇", author: "賈島" },
  { text: "只在此山中", source: "尋隱者不遇", author: "賈島" },
  { text: "雲深不知處", source: "尋隱者不遇", author: "賈島" },

  { text: "紅豆生南國", source: "相思", author: "王維" },
  { text: "春來發幾枝", source: "相思", author: "王維" },
  { text: "願君多採擷", source: "相思", author: "王維" },
  { text: "此物最相思", source: "相思", author: "王維" },

  { text: "空山新雨後", source: "山居秋暝", author: "王維" },
  { text: "天氣晚來秋", source: "山居秋暝", author: "王維" },
  { text: "明月松間照", source: "山居秋暝", author: "王維" },
  { text: "清泉石上流", source: "山居秋暝", author: "王維" },

  { text: "海上生明月", source: "望月懷遠", author: "張九齡" },
  { text: "天涯共此時", source: "望月懷遠", author: "張九齡" },

  { text: "誰言寸草心", source: "遊子吟", author: "孟郊" },
  { text: "報得三春暉", source: "遊子吟", author: "孟郊" },
];

export const POEMS_7: PoemLine[] = [
  { text: "兩個黃鸝鳴翠柳", source: "絕句", author: "杜甫" },
  { text: "一行白鷺上青天", source: "絕句", author: "杜甫" },
  { text: "窗含西嶺千秋雪", source: "絕句", author: "杜甫" },
  { text: "門泊東吳萬里船", source: "絕句", author: "杜甫" },

  { text: "黃四娘家花滿蹊", source: "江畔獨步尋花", author: "杜甫" },
  { text: "千朵萬朵壓枝低", source: "江畔獨步尋花", author: "杜甫" },
  { text: "留連戲蝶時時舞", source: "江畔獨步尋花", author: "杜甫" },
  { text: "自在嬌鶯恰恰啼", source: "江畔獨步尋花", author: "杜甫" },

  { text: "故人西辭黃鶴樓", source: "黃鶴樓送孟浩然之廣陵", author: "李白" },
  { text: "煙花三月下揚州", source: "黃鶴樓送孟浩然之廣陵", author: "李白" },
  { text: "孤帆遠影碧空盡", source: "黃鶴樓送孟浩然之廣陵", author: "李白" },
  { text: "唯見長江天際流", source: "黃鶴樓送孟浩然之廣陵", author: "李白" },

  { text: "日照香爐生紫煙", source: "望廬山瀑布", author: "李白" },
  { text: "遙看瀑布掛前川", source: "望廬山瀑布", author: "李白" },
  { text: "飛流直下三千尺", source: "望廬山瀑布", author: "李白" },
  { text: "疑是銀河落九天", source: "望廬山瀑布", author: "李白" },

  { text: "千里黃雲白日曛", source: "別董大", author: "高適" },
  { text: "北風吹雁雪紛紛", source: "別董大", author: "高適" },
  { text: "莫愁前路無知己", source: "別董大", author: "高適" },
  { text: "天下誰人不識君", source: "別董大", author: "高適" },

  { text: "渭城朝雨浥輕塵", source: "送元二使安西", author: "王維" },
  { text: "客舍青青柳色新", source: "送元二使安西", author: "王維" },
  { text: "勸君更盡一杯酒", source: "送元二使安西", author: "王維" },
  { text: "西出陽關無故人", source: "送元二使安西", author: "王維" },

  { text: "獨在異鄉為異客", source: "九月九日憶山東兄弟", author: "王維" },
  { text: "每逢佳節倍思親", source: "九月九日憶山東兄弟", author: "王維" },
  { text: "遙知兄弟登高處", source: "九月九日憶山東兄弟", author: "王維" },
  { text: "遍插茱萸少一人", source: "九月九日憶山東兄弟", author: "王維" },

  { text: "千門萬戶曈曈日", source: "元日", author: "王安石" },
  { text: "總把新桃換舊符", source: "元日", author: "王安石" },
  { text: "爆竹聲中一歲除", source: "元日", author: "王安石" },
  { text: "春風送暖入屠蘇", source: "元日", author: "王安石" },

  { text: "清明時節雨紛紛", source: "清明", author: "杜牧" },
  { text: "路上行人欲斷魂", source: "清明", author: "杜牧" },
  { text: "借問酒家何處有", source: "清明", author: "杜牧" },
  { text: "牧童遙指杏花村", source: "清明", author: "杜牧" },

  { text: "停車坐愛楓林晚", source: "山行", author: "杜牧" },
  { text: "霜葉紅於二月花", source: "山行", author: "杜牧" },
  { text: "遠上寒山石徑斜", source: "山行", author: "杜牧" },
  { text: "白雲深處有人家", source: "山行", author: "杜牧" },

  { text: "接天蓮葉無窮碧", source: "曉出淨慈寺送林子方", author: "楊萬里" },
  { text: "映日荷花別樣紅", source: "曉出淨慈寺送林子方", author: "楊萬里" },

  { text: "綠樹陰濃夏日長", source: "山亭夏日", author: "高駢" },
  { text: "樓臺倒影入池塘", source: "山亭夏日", author: "高駢" },

  { text: "墻角數枝梅", source: "梅花", author: "王安石" },
  { text: "凌寒獨自開", source: "梅花", author: "王安石" },
  { text: "遙知不是雪", source: "梅花", author: "王安石" },
  { text: "為有暗香來", source: "梅花", author: "王安石" },
];

export const POEM_5_SET = new Set(POEMS_5.map((p) => p.text));
export const POEM_7_SET = new Set(POEMS_7.map((p) => p.text));
