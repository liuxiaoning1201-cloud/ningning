// ==================== 詞庫與素材 ====================
//
// 這是「精選詞庫」的起始子集（涵蓋六要素、各難度層），用以驅動所有遊戲機制。
// 設計目標約 1,500-1,800 詞，可透過設定中的「Excel 匯入」擴充至官方
// 《香港小學學習字詞表》規模。欄位對應計劃書 VocabItem：
//   word / pos / element / stage(KS1|KS2) / gradeHint / frequency / difficulty
//   / theme / example / pinyin
//
// element（魔方六面 = 記敘文六要素）：
//   who 人物 / where 地點 / when 時間 / event 事件 / emotion 心情 / descriptor 好詞
//
// 以 IIFE 包裹，避免 ELEMENTS / ELEMENT_ORDER / SCENES 等識別字洩漏到全域，
// 與 app.js 的同名解構宣告衝突（多個 classic script 共用全域語彙環境）。

(function () {

const ELEMENTS = {
    who:        { color: '#FF6B6B', label: '人物', emoji: '🧑', slotLabel: '誰' },
    where:      { color: '#4ECDC4', label: '地點', emoji: '🏞️', slotLabel: '在哪裡' },
    when:       { color: '#FFD93D', label: '時間', emoji: '🕐', slotLabel: '甚麼時候' },
    event:      { color: '#95E1D3', label: '事件', emoji: '⚡', slotLabel: '發生甚麼' },
    emotion:    { color: '#F38181', label: '心情', emoji: '😊', slotLabel: '心情' },
    descriptor: { color: '#C8A2C8', label: '好詞', emoji: '✨', slotLabel: '好詞好句' },
};

const ELEMENT_ORDER = ['who', 'where', 'when', 'event', 'emotion', 'descriptor'];

// 難度 1-6 大致對應小一至小六；frequency 0-1（越大越常用）
function W(word, element, difficulty, frequency, opts = {}) {
    const stage = difficulty <= 3 ? 'KS1' : 'KS2';
    return {
        id: opts.id || ('w_' + word),
        word,
        element,
        difficulty,
        frequency,
        stage,
        gradeHint: opts.gradeHint || difficulty,
        pos: opts.pos || '',
        theme: opts.theme || [],
        example: opts.example || '',
        pinyin: opts.pinyin || '',
        source: 'builtin',
    };
}

const BUILTIN_WORDS = [
    // ---- 人物 who ----
    W('小貓', 'who', 1, 0.95, { pos: '名詞', theme: ['動物'], example: '一隻小貓在牆角睡覺。' }),
    W('小狗', 'who', 1, 0.95, { pos: '名詞', theme: ['動物'], example: '小狗高興地搖著尾巴。' }),
    W('小兔', 'who', 1, 0.9, { pos: '名詞', theme: ['動物'], example: '小兔蹦蹦跳跳地跑過來。' }),
    W('媽媽', 'who', 1, 0.98, { pos: '名詞', theme: ['家庭'], example: '媽媽溫柔地抱著我。' }),
    W('老師', 'who', 1, 0.95, { pos: '名詞', theme: ['學校'], example: '老師在黑板上寫字。' }),
    W('小男孩', 'who', 1, 0.9, { pos: '名詞', theme: ['人'], example: '小男孩開心地笑了。' }),
    W('小女孩', 'who', 1, 0.9, { pos: '名詞', theme: ['人'], example: '小女孩採了一朵花。' }),
    W('老爺爺', 'who', 2, 0.8, { pos: '名詞', theme: ['人'], example: '老爺爺坐在樹下乘涼。' }),
    W('農夫', 'who', 2, 0.7, { pos: '名詞', theme: ['職業'], example: '農夫在田裡辛勤耕作。' }),
    W('漁夫', 'who', 3, 0.6, { pos: '名詞', theme: ['職業'], example: '漁夫划著小船出海。' }),
    W('太空人', 'who', 3, 0.6, { pos: '名詞', theme: ['太空'], example: '太空人在月球上漫步。' }),
    W('機器人', 'who', 2, 0.7, { pos: '名詞', theme: ['科技'], example: '機器人會幫忙做家務。' }),
    W('精靈', 'who', 4, 0.45, { pos: '名詞', theme: ['童話'], example: '森林裡住著一個小精靈。' }),
    W('巨人', 'who', 4, 0.5, { pos: '名詞', theme: ['童話'], example: '山谷裡走來一個巨人。' }),
    W('探險家', 'who', 4, 0.45, { pos: '名詞', theme: ['冒險'], example: '探險家背著行囊出發了。' }),
    W('魔法師', 'who', 5, 0.4, { pos: '名詞', theme: ['童話'], example: '魔法師揮動著手中的法杖。' }),

    // ---- 地點 where ----
    W('學校', 'where', 1, 0.97, { pos: '名詞', theme: ['學校'], example: '我每天高興地走進學校。' }),
    W('公園', 'where', 1, 0.95, { pos: '名詞', theme: ['生活'], example: '公園裡開滿了鮮花。' }),
    W('森林', 'where', 2, 0.85, { pos: '名詞', theme: ['自然'], example: '森林裡的樹木又高又密。' }),
    W('海邊', 'where', 2, 0.85, { pos: '名詞', theme: ['自然'], example: '海邊的沙灘軟軟的。' }),
    W('花園', 'where', 1, 0.9, { pos: '名詞', theme: ['生活'], example: '花園裡蝴蝶翩翩起舞。' }),
    W('教室', 'where', 1, 0.92, { pos: '名詞', theme: ['學校'], example: '教室裡靜悄悄的。' }),
    W('山頂', 'where', 3, 0.65, { pos: '名詞', theme: ['自然'], example: '我們終於爬上了山頂。' }),
    W('月球', 'where', 3, 0.55, { pos: '名詞', theme: ['太空'], example: '月球上沒有空氣。' }),
    W('村莊', 'where', 3, 0.6, { pos: '名詞', theme: ['鄉村'], example: '小小的村莊安靜又祥和。' }),
    W('城堡', 'where', 3, 0.6, { pos: '名詞', theme: ['童話'], example: '城堡高高地聳立在山上。' }),
    W('圖書館', 'where', 2, 0.75, { pos: '名詞', theme: ['學校'], example: '圖書館裡有許多書。' }),
    W('遊樂場', 'where', 2, 0.8, { pos: '名詞', theme: ['生活'], example: '遊樂場裡傳來歡笑聲。' }),
    W('洞穴', 'where', 4, 0.45, { pos: '名詞', theme: ['冒險'], example: '黑漆漆的洞穴裡靜得可怕。' }),
    W('沙漠', 'where', 4, 0.5, { pos: '名詞', theme: ['自然'], example: '沙漠裡一望無際，全是黃沙。' }),
    W('森林深處', 'where', 4, 0.4, { pos: '名詞', theme: ['自然'], example: '森林深處藏著一間小木屋。' }),

    // ---- 時間 when ----
    W('清晨', 'when', 2, 0.85, { pos: '名詞', theme: ['時間'], example: '清晨的空氣格外清新。' }),
    W('中午', 'when', 1, 0.92, { pos: '名詞', theme: ['時間'], example: '中午的太陽火辣辣的。' }),
    W('黃昏', 'when', 3, 0.65, { pos: '名詞', theme: ['時間'], example: '黃昏的天空染成了橘紅色。' }),
    W('深夜', 'when', 3, 0.6, { pos: '名詞', theme: ['時間'], example: '深夜裡四周一片寂靜。' }),
    W('春天', 'when', 1, 0.95, { pos: '名詞', theme: ['四季'], example: '春天到了，花兒都開了。' }),
    W('夏天', 'when', 1, 0.95, { pos: '名詞', theme: ['四季'], example: '夏天的午後很悶熱。' }),
    W('秋天', 'when', 1, 0.93, { pos: '名詞', theme: ['四季'], example: '秋天的落葉鋪滿了地面。' }),
    W('冬天', 'when', 1, 0.93, { pos: '名詞', theme: ['四季'], example: '冬天下起了鵝毛大雪。' }),
    W('雨天', 'when', 2, 0.8, { pos: '名詞', theme: ['天氣'], example: '雨天的街道濕漉漉的。' }),
    W('放學後', 'when', 2, 0.8, { pos: '名詞', theme: ['學校'], example: '放學後我們一起回家。' }),
    W('暴風雨的夜晚', 'when', 4, 0.4, { pos: '短語', theme: ['天氣'], example: '暴風雨的夜晚，雷聲轟隆隆。' }),
    W('黎明時分', 'when', 5, 0.35, { pos: '短語', theme: ['時間'], example: '黎明時分，天邊泛起魚肚白。' }),

    // ---- 事件 event ----
    W('迷路', 'event', 2, 0.8, { pos: '動詞', theme: ['冒險'], example: '小貓在森林裡迷路了。' }),
    W('探險', 'event', 3, 0.7, { pos: '動詞', theme: ['冒險'], example: '他們決定去山洞探險。' }),
    W('比賽', 'event', 2, 0.85, { pos: '名詞', theme: ['活動'], example: '一場有趣的比賽開始了。' }),
    W('尋寶', 'event', 3, 0.6, { pos: '動詞', theme: ['冒險'], example: '我們按照地圖去尋寶。' }),
    W('救援', 'event', 4, 0.5, { pos: '動詞', theme: ['冒險'], example: '消防員趕來救援。' }),
    W('相遇', 'event', 3, 0.6, { pos: '動詞', theme: ['情感'], example: '他們在橋上偶然相遇。' }),
    W('發現', 'event', 2, 0.85, { pos: '動詞', theme: ['日常'], example: '我發現草叢裡有一隻小刺蝟。' }),
    W('幫忙', 'event', 1, 0.9, { pos: '動詞', theme: ['日常'], example: '我幫忙媽媽提東西。' }),
    W('慶祝', 'event', 3, 0.65, { pos: '動詞', theme: ['活動'], example: '大家一起慶祝生日。' }),
    W('告別', 'event', 4, 0.5, { pos: '動詞', theme: ['情感'], example: '我們依依不捨地告別。' }),
    W('團聚', 'event', 4, 0.45, { pos: '動詞', theme: ['情感'], example: '一家人開心地團聚。' }),
    W('歷險', 'event', 5, 0.35, { pos: '動詞', theme: ['冒險'], example: '這真是一次難忘的歷險。' }),

    // ---- 心情 emotion ----
    W('開心', 'emotion', 1, 0.97, { pos: '形容詞', theme: ['情緒'], example: '收到禮物，我非常開心。' }),
    W('難過', 'emotion', 1, 0.9, { pos: '形容詞', theme: ['情緒'], example: '聽到這個消息，他很難過。' }),
    W('緊張', 'emotion', 2, 0.85, { pos: '形容詞', theme: ['情緒'], example: '上台前我有點緊張。' }),
    W('害怕', 'emotion', 1, 0.9, { pos: '形容詞', theme: ['情緒'], example: '天黑了，妹妹有些害怕。' }),
    W('生氣', 'emotion', 1, 0.9, { pos: '形容詞', theme: ['情緒'], example: '弟弟弄壞玩具，他很生氣。' }),
    W('驚訝', 'emotion', 3, 0.7, { pos: '形容詞', theme: ['情緒'], example: '看到這一幕，我驚訝得張大了嘴。' }),
    W('興奮', 'emotion', 2, 0.8, { pos: '形容詞', theme: ['情緒'], example: '明天要去旅行，我興奮得睡不著。' }),
    W('孤單', 'emotion', 3, 0.6, { pos: '形容詞', theme: ['情緒'], example: '一個人在家，他覺得很孤單。' }),
    W('感動', 'emotion', 3, 0.65, { pos: '形容詞', theme: ['情緒'], example: '老師的話讓我十分感動。' }),
    W('後悔', 'emotion', 4, 0.55, { pos: '形容詞', theme: ['情緒'], example: '說了謊以後，我很後悔。' }),
    W('忐忑不安', 'emotion', 5, 0.35, { pos: '成語', theme: ['情緒'], example: '等待成績時，我忐忑不安。' }),
    W('喜出望外', 'emotion', 5, 0.35, { pos: '成語', theme: ['情緒'], example: '中了獎，他喜出望外。' }),

    // ---- 好詞 descriptor ----
    W('亮晶晶', 'descriptor', 2, 0.75, { pos: 'ABB', theme: ['描寫'], example: '星星在天上亮晶晶的。' }),
    W('金燦燦', 'descriptor', 3, 0.6, { pos: 'ABB', theme: ['描寫', '陽光'], example: '稻田金燦燦的，像鋪了一地黃金。' }),
    W('綠油油', 'descriptor', 2, 0.7, { pos: 'ABB', theme: ['描寫', '植物'], example: '田裡的秧苗綠油油的。' }),
    W('香噴噴', 'descriptor', 2, 0.72, { pos: 'ABB', theme: ['描寫'], example: '廚房裡飄來香噴噴的味道。' }),
    W('軟綿綿', 'descriptor', 2, 0.68, { pos: 'ABB', theme: ['描寫'], example: '雲朵像軟綿綿的棉花糖。' }),
    W('興高采烈', 'descriptor', 4, 0.55, { pos: '成語', theme: ['描寫', '情緒'], example: '同學們興高采烈地去秋遊。' }),
    W('小心翼翼', 'descriptor', 4, 0.55, { pos: '成語', theme: ['描寫'], example: '他小心翼翼地捧著雞蛋。' }),
    W('一望無際', 'descriptor', 4, 0.5, { pos: '成語', theme: ['描寫', '自然'], example: '大海一望無際，藍得發亮。' }),
    W('五顏六色', 'descriptor', 3, 0.65, { pos: '成語', theme: ['描寫', '顏色'], example: '花園裡開著五顏六色的花。' }),
    W('熱鬧非凡', 'descriptor', 5, 0.4, { pos: '成語', theme: ['描寫'], example: '節日的街道熱鬧非凡。' }),
    W('鴉雀無聲', 'descriptor', 5, 0.4, { pos: '成語', theme: ['描寫'], example: '考試時教室裡鴉雀無聲。' }),
    W('波光粼粼', 'descriptor', 6, 0.3, { pos: '成語', theme: ['描寫', '自然'], example: '湖面波光粼粼，美極了。' }),
    W('生機勃勃', 'descriptor', 6, 0.3, { pos: '成語', theme: ['描寫', '自然'], example: '春天的大地生機勃勃。' }),
    W('層巒疊嶂', 'descriptor', 6, 0.25, { pos: '成語', theme: ['描寫', '自然'], example: '遠處層巒疊嶂，雲霧繚繞。' }),
    W('自由自在', 'descriptor', 4, 0.55, { pos: '成語', theme: ['描寫'], example: '小魚在水裡自由自在地游。' }),
];

// 看圖寫話的「圖」：以漸層 + emoji 拼貼作為起始素材（可日後換成 AI 生成或上傳）
const SCENES = [
    { id: 'park', title: '公園的一天', emojis: ['🌳', '🌸', '🦋', '☀️', '🪁'], gradient: ['#a8e6cf', '#dcedc1'], theme: '生活',
      hintElements: ['who', 'event', 'emotion'] },
    { id: 'sea', title: '海邊探險', emojis: ['🌊', '🏖️', '🐚', '⛵', '🦀'], gradient: ['#48c6ef', '#6f86d6'], theme: '自然',
      hintElements: ['who', 'event', 'descriptor'] },
    { id: 'forest', title: '神秘森林', emojis: ['🌲', '🦊', '🍄', '🦉', '🌙'], gradient: ['#134e5e', '#71b280'], theme: '童話',
      hintElements: ['who', 'where', 'emotion'] },
    { id: 'space', title: '太空旅行', emojis: ['🚀', '🪐', '⭐', '🌌', '👨‍🚀'], gradient: ['#0f2027', '#2c5364'], theme: '太空',
      hintElements: ['who', 'where', 'event'] },
    { id: 'winter', title: '下雪的早晨', emojis: ['❄️', '⛄', '🏠', '🎄', '🧣'], gradient: ['#83a4d4', '#b6fbff'], theme: '四季',
      hintElements: ['when', 'who', 'emotion'] },
    { id: 'school', title: '快樂校園', emojis: ['🏫', '📚', '✏️', '🎒', '🔔'], gradient: ['#ffecd2', '#fcb69f'], theme: '學校',
      hintElements: ['who', 'event', 'emotion'] },
];

window.LGMF_DATA = { ELEMENTS, ELEMENT_ORDER, BUILTIN_WORDS, SCENES, W };

})();
