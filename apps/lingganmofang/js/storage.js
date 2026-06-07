// ==================== 資料管理（localStorage） ====================

const STORAGE_KEYS = {
    vocabLibrary: 'lgmf_vocab_library',   // 使用者匯入的詞庫（覆蓋/擴充內建）
    wordProgress: 'lgmf_word_progress',   // 每個詞的學習狀態（SRS + usedInWriting + recentUse）
    works:        'lgmf_works',           // 作品集
    settings:     'lgmf_settings',        // 學習者設定
    stats:        'lgmf_stats',           // 整體統計（自適應用）
};

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}
function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ---- 詞庫 ----
function loadUserWords() {
    const data = readJSON(STORAGE_KEYS.vocabLibrary, { words: [] });
    return Array.isArray(data.words) ? data.words : [];
}
function saveUserWords(words) {
    writeJSON(STORAGE_KEYS.vocabLibrary, { words });
}
function getAllWords() {
    const user = loadUserWords();
    // 使用者詞以同 id 覆蓋內建
    const map = new Map();
    window.LGMF_DATA.BUILTIN_WORDS.forEach(w => map.set(w.id, w));
    user.forEach(w => map.set(w.id, w));
    return Array.from(map.values());
}

// ---- 學習進度 ----
const DEFAULT_SETTINGS = {
    startLevel: 'KS1',
    challengeIntensity: 'balanced', // gentle | balanced | bold
    requiredStretchPerStory: 2,
    themePreference: [],
    showPinyin: true,
    autoAdapt: true,
    childLevel: 1.5,   // 連續水平估計（約對應難度刻度 1-6）
    reachDelta: 1.2,   // 桃子高度
};

function loadSettings() {
    return { ...DEFAULT_SETTINGS, ...readJSON(STORAGE_KEYS.settings, {}) };
}
function saveSettings(s) {
    writeJSON(STORAGE_KEYS.settings, s);
}

function loadProgress() {
    return readJSON(STORAGE_KEYS.wordProgress, {});
}
function saveProgress(p) {
    writeJSON(STORAGE_KEYS.wordProgress, p);
}
function getWordProgress(wordId) {
    const all = loadProgress();
    return all[wordId] || { wordId, srs: { ...window.SRS.DEFAULT_SRS }, reviews: 0, usedInWriting: 0, recentUse: 0 };
}
function setWordProgress(wordId, prog) {
    const all = loadProgress();
    all[wordId] = prog;
    saveProgress(all);
}

// ---- 作品集 ----
function loadWorks() {
    return readJSON(STORAGE_KEYS.works, []);
}
function saveWorks(works) {
    writeJSON(STORAGE_KEYS.works, works);
}
function addWork(work) {
    const works = loadWorks();
    works.unshift(work);
    saveWorks(works);
}
function deleteWork(id) {
    saveWorks(loadWorks().filter(w => w.id !== id));
}

// ---- 統計（自適應用） ----
function loadStats() {
    return readJSON(STORAGE_KEYS.stats, { recentOutcomes: [], totalWorks: 0, totalWordsUsed: 0 });
}
function saveStats(s) {
    writeJSON(STORAGE_KEYS.stats, s);
}

// ---- Excel 匯入匯出（沿用 xlsx，對應計劃書欄位） ----
function exportVocabExcel() {
    const rows = getAllWords().map(w => ({
        word: w.word, pos: w.pos, element: w.element, stage: w.stage,
        gradeHint: w.gradeHint, frequency: w.frequency, difficulty: w.difficulty,
        theme: (w.theme || []).join('；'), example: w.example, pinyin: w.pinyin,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'vocab');
    downloadBlob(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), '靈感魔方-詞庫.xlsx');
}

function importVocabExcel(file, onDone) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
            const words = rows.filter(r => r.word).map((r, i) => ({
                id: 'u_' + (r.word) + '_' + i,
                word: String(r.word),
                pos: r.pos || '',
                element: r.element || 'descriptor',
                stage: r.stage || (Number(r.difficulty) <= 3 ? 'KS1' : 'KS2'),
                gradeHint: Number(r.gradeHint) || Number(r.difficulty) || 3,
                frequency: Number(r.frequency) || 0.5,
                difficulty: Number(r.difficulty) || 3,
                theme: String(r.theme || '').split(/[；;，,、]+/).filter(Boolean),
                example: r.example || '',
                pinyin: r.pinyin || '',
                source: 'user',
            }));
            saveUserWords(words);
            onDone(words.length, null);
        } catch (err) {
            onDone(0, err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function downloadVocabTemplate() {
    const template = [
        { word: '金燦燦', pos: '形容詞', element: 'descriptor', stage: 'KS2', gradeHint: 5,
          frequency: 0.62, difficulty: 3, theme: '秋天；陽光', example: '稻田金燦燦的。', pinyin: 'jīn càn càn' },
        { word: '小貓', pos: '名詞', element: 'who', stage: 'KS1', gradeHint: 1,
          frequency: 0.95, difficulty: 1, theme: '動物', example: '一隻小貓。', pinyin: 'xiǎo māo' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '詞庫模板');
    downloadBlob(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), '靈感魔方-詞庫模板.xlsx');
}

function downloadBlob(arrayBuffer, filename) {
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

window.Store = {
    STORAGE_KEYS, DEFAULT_SETTINGS,
    getAllWords, loadUserWords, saveUserWords,
    loadSettings, saveSettings,
    loadProgress, saveProgress, getWordProgress, setWordProgress,
    loadWorks, saveWorks, addWork, deleteWork,
    loadStats, saveStats,
    exportVocabExcel, importVocabExcel, downloadVocabTemplate,
};
