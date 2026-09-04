/**
 * 內建成語詞典（含釋義，4 字成語）。
 * 作為 B 模式 / complete idiom 校驗的權威來源。
 * 老師可在前端「詞庫」匯入更多成語覆蓋此預設。
 */

export interface IdiomEntry {
  text: string;
  definition: string;
}

export const BUILTIN_IDIOMS: IdiomEntry[] = [
  { text: "一心一意", definition: "心思專一，毫不分心" },
  { text: "一鳴驚人", definition: "比喻平時默默無聞，一旦行動便有驚人表現" },
  { text: "一帆風順", definition: "比喻事情非常順利" },
  { text: "一目了然", definition: "一眼就看得清清楚楚" },
  { text: "一馬當先", definition: "比喻領先帶頭" },
  { text: "畫蛇添足", definition: "比喻做了多餘的事反而壞事" },
  { text: "守株待兔", definition: "比喻不思進取，妄想坐享其成" },
  { text: "井底之蛙", definition: "比喻見識短淺的人" },
  { text: "胸有成竹", definition: "比喻做事前已有完整計畫" },
  { text: "對牛彈琴", definition: "比喻對不懂的人講道理，白費力氣" },
  { text: "亡羊補牢", definition: "比喻出了問題後及時補救還不算晚" },
  { text: "杯弓蛇影", definition: "比喻因疑神疑鬼而自相驚擾" },
  { text: "拔苗助長", definition: "比喻違反事物發展規律，急於求成反而壞事" },
  { text: "南轅北轍", definition: "比喻行動和目的相反" },
  { text: "刻舟求劍", definition: "比喻拘泥固執不知變通" },
  { text: "塞翁失馬", definition: "比喻禍福相倚，壞事可能變好事" },
  { text: "葉公好龍", definition: "比喻表面喜愛某事物，實際並非如此" },
  { text: "畫龍點睛", definition: "比喻在關鍵處加上一筆使整體生動起來" },
  { text: "聞雞起舞", definition: "形容有志之人勤奮自勵" },
  { text: "鐵杵磨針", definition: "比喻只要有恆心，再難的事也能成" },

  { text: "心曠神怡", definition: "心情舒暢，精神愉快" },
  { text: "目不轉睛", definition: "形容看得入神" },
  { text: "全神貫注", definition: "全部精神集中" },
  { text: "聚精會神", definition: "集中精神，全心投入" },
  { text: "專心致志", definition: "一心一意，專注於一事" },
  { text: "廢寢忘食", definition: "形容十分專心努力" },
  { text: "孜孜不倦", definition: "勤奮努力不懈怠" },
  { text: "持之以恆", definition: "長期堅持下去" },
  { text: "堅持不懈", definition: "堅持到底，毫不鬆懈" },
  { text: "鍥而不捨", definition: "比喻有恆心，不停止" },
  { text: "水滴石穿", definition: "比喻只要有恆心，不斷努力，事情就能成功" },
  { text: "繩鋸木斷", definition: "比喻力量雖小，只要堅持就能成功" },

  { text: "春暖花開", definition: "形容春天溫暖的好天氣" },
  { text: "鳥語花香", definition: "形容春天景色怡人" },
  { text: "春光明媚", definition: "形容春天景色鮮艷明亮" },
  { text: "桃紅柳綠", definition: "形容春天的繽紛色彩" },
  { text: "百花齊放", definition: "形容花朵盛開或事物繁榮" },
  { text: "風和日麗", definition: "形容天氣晴朗暖和" },
  { text: "萬紫千紅", definition: "形容花朵繁多色彩艷麗" },
  { text: "草長鶯飛", definition: "形容春天大自然的景象" },

  { text: "驕陽似火", definition: "形容夏天太陽極為熾熱" },
  { text: "汗流浹背", definition: "形容因熱或勞累而流很多汗" },
  { text: "綠樹成蔭", definition: "形容夏天樹木茂盛" },
  { text: "金風送爽", definition: "形容秋天涼爽宜人" },
  { text: "碩果纍纍", definition: "形容秋天收穫豐盛" },
  { text: "層林盡染", definition: "形容秋天樹葉變紅染滿山林" },
  { text: "天高雲淡", definition: "形容秋天天空高遠雲層稀薄" },
  { text: "冰天雪地", definition: "形容到處都是冰雪" },
  { text: "天寒地凍", definition: "形容天氣極冷" },
  { text: "白雪皚皚", definition: "形容白雪覆蓋一片潔白" },

  { text: "山清水秀", definition: "形容山水秀麗風景優美" },
  { text: "湖光山色", definition: "形容湖泊與山岳風景秀美" },
  { text: "風景如畫", definition: "形容風景美得像畫" },
  { text: "巍峨壯麗", definition: "形容山勢高大雄偉" },
  { text: "高聳入雲", definition: "形容山或建築物極高" },
  { text: "波瀾壯闊", definition: "形容氣勢雄偉" },
  { text: "一望無際", definition: "形容遼闊無邊" },

  { text: "活潑可愛", definition: "形容生動可愛" },
  { text: "天真爛漫", definition: "形容兒童純真自然" },
  { text: "聰明伶俐", definition: "形容人聰明而機靈" },
  { text: "勇敢機智", definition: "形容勇敢且有智慧" },
  { text: "彬彬有禮", definition: "形容人有禮貌" },
  { text: "謙虛謹慎", definition: "態度謙遜做事小心" },
  { text: "溫文爾雅", definition: "形容人文雅有禮" },
  { text: "風度翩翩", definition: "形容舉止灑脫優美" },
  { text: "滿腹經綸", definition: "形容人才學淵博" },
  { text: "出口成章", definition: "形容口才好，思維敏捷" },
  { text: "妙語連珠", definition: "形容說話精彩連續不斷" },
  { text: "口若懸河", definition: "形容能言善辯" },
  { text: "滔滔不絕", definition: "形容說話多而流暢" },

  { text: "助人為樂", definition: "把幫助別人當作快樂" },
  { text: "見義勇為", definition: "看到正義的事勇敢去做" },
  { text: "拾金不昧", definition: "撿到財物不據為己有" },
  { text: "捨己為人", definition: "犧牲自己利益幫助別人" },
  { text: "默默無聞", definition: "不出名，不被人注意" },
  { text: "鞠躬盡瘁", definition: "竭盡心力為公眾服務" },

  { text: "勤學苦練", definition: "勤奮學習刻苦練習" },
  { text: "精益求精", definition: "已經很好還要更好" },
  { text: "腳踏實地", definition: "形容做事踏實" },
  { text: "一絲不苟", definition: "形容做事認真不馬虎" },
  { text: "兢兢業業", definition: "形容工作謹慎認真" },
  { text: "勤勤懇懇", definition: "勤勉而踏實" },

  { text: "團結一致", definition: "齊心協力共同行動" },
  { text: "同心協力", definition: "齊心合力共同努力" },
  { text: "齊心合力", definition: "團結一致" },
  { text: "眾志成城", definition: "大家團結就像城牆一樣堅固" },
  { text: "風雨同舟", definition: "比喻共同經歷困難" },
  { text: "同甘共苦", definition: "共同享受幸福也共同承擔困難" },

  { text: "有志竟成", definition: "只要有志向終能成功" },
  { text: "百折不撓", definition: "形容意志堅強百次挫折也不退縮" },
  { text: "迎難而上", definition: "面對困難勇敢前進" },
  { text: "勇往直前", definition: "勇敢地一直往前" },
  { text: "頂天立地", definition: "形容氣概豪邁堅強" },
  { text: "破釜沉舟", definition: "比喻下定決心不留退路" },
  { text: "背水一戰", definition: "比喻決一死戰" },

  { text: "心驚膽戰", definition: "形容非常害怕" },
  { text: "驚心動魄", definition: "形容感受極深震撼人心" },
  { text: "提心吊膽", definition: "形容十分擔心害怕" },
  { text: "忐忑不安", definition: "心裡七上八下不能平靜" },
  { text: "目瞪口呆", definition: "形容因驚訝而發愣" },
  { text: "瞠目結舌", definition: "形容驚訝得說不出話" },
  { text: "喜出望外", definition: "意外的喜事使人特別高興" },
  { text: "歡天喜地", definition: "形容非常高興" },
  { text: "歡欣鼓舞", definition: "形容十分高興振奮" },
  { text: "心花怒放", definition: "形容極其欣喜" },

  { text: "風吹草動", definition: "比喻有些微動靜" },
  { text: "風和日麗", definition: "形容天氣晴朗" },
  { text: "風雨交加", definition: "形容大風夾著大雨" },
  { text: "雪上加霜", definition: "比喻禍上加禍" },
  { text: "雷霆萬鈞", definition: "形容氣勢威力極大" },
  { text: "驚濤駭浪", definition: "形容極大的風浪" },
  { text: "風起雲湧", definition: "形容事物迅速發展" },
];

/** 為了快速 lookup，保留一份 Set */
export const BUILTIN_IDIOM_SET = new Set(BUILTIN_IDIOMS.map((i) => i.text));
