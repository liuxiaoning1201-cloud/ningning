// ==================== 自適應難度引擎（跳一跳摘到桃子） ====================

// 每面 9 格的難度配比：熟詞給安全感、學習中鞏固、新詞(桃子)是成長點
const FILL_RATIO = { mastered: 0.3, learning: 0.5, stretch: 0.2 };

// 挑戰強度 -> 桃子高度與新詞比例
const INTENSITY = {
    gentle:   { reachDelta: 0.8, stretchBoost: 0.0 },
    balanced: { reachDelta: 1.2, stretchBoost: 0.0 },
    bold:     { reachDelta: 1.8, stretchBoost: 0.1 },
};

const Adaptive = {
    // 按詞的學習階層分桶
    bucketize(words) {
        const buckets = { mastered: [], learning: [], unseen: [] };
        words.forEach(w => {
            const p = window.Store.getWordProgress(w.id);
            const stage = window.SRS.stageFromProgress(p);
            const item = { word: w, progress: p, stage };
            if (stage === 'produce') buckets.mastered.push(item);
            else if (stage === 'new') buckets.unseen.push(item);
            else buckets.learning.push(item);
        });
        return buckets;
    },

    // 桃子：難度比當前水平高一點點的「未見」新詞
    pickStretch(unseen, childLevel, reachDelta) {
        const inReach = unseen.filter(it =>
            it.word.difficulty > childLevel &&
            it.word.difficulty <= childLevel + reachDelta);
        const pool = inReach.length ? inReach : unseen;
        return this.weightedShuffle(pool);
    },

    // 反重複壓力：最近常用的詞，權重衰減
    weightedShuffle(items) {
        return items
            .map(it => ({
                it,
                key: Math.random() * Math.pow(0.6, it.progress.recentUse || 0) * (0.5 + it.word.frequency),
            }))
            .sort((a, b) => b.key - a.key)
            .map(x => x.it);
    },

    // 為某要素面挑出 n 個詞（按配比混合）
    deckForElement(element, n = 9) {
        const settings = window.Store.loadSettings();
        const intensity = INTENSITY[settings.challengeIntensity] || INTENSITY.balanced;
        const reachDelta = settings.reachDelta || intensity.reachDelta;
        const childLevel = settings.childLevel || 1.5;

        const words = window.Store.getAllWords().filter(w => w.element === element);
        const buckets = this.bucketize(words);

        const stretchRatio = FILL_RATIO.stretch + intensity.stretchBoost;
        const nStretch = Math.max(1, Math.round(n * stretchRatio));
        const nMastered = Math.round(n * FILL_RATIO.mastered);
        const nLearning = n - nStretch - nMastered;

        const pickFrom = (arr, k) => this.weightedShuffle(arr).slice(0, k);

        let chosen = [
            ...pickFrom(buckets.mastered, nMastered),
            ...pickFrom(buckets.learning, nLearning),
            ...this.pickStretch(buckets.unseen, childLevel, reachDelta).slice(0, nStretch),
        ];

        // 不足時用任意同類詞補滿
        if (chosen.length < n) {
            const used = new Set(chosen.map(c => c.word.id));
            const rest = this.weightedShuffle(
                this.bucketizeFlat(words).filter(it => !used.has(it.word.id)));
            chosen = chosen.concat(rest.slice(0, n - chosen.length));
        }
        return this.weightedShuffle(chosen).slice(0, n);
    },

    bucketizeFlat(words) {
        return words.map(w => {
            const p = window.Store.getWordProgress(w.id);
            return { word: w, progress: p, stage: window.SRS.stageFromProgress(p) };
        });
    },

    // 差異化計分：用新詞比用熟詞更划算
    scoreWord(stage) {
        if (stage === 'produce') return 1;
        if (stage === 'understand') return 3;
        if (stage === 'recognize') return 2;
        return 5; // new / 桃子
    },

    // 記錄一次「在創作中使用某詞」：推進 SRS 與階層
    recordUse(wordId, opts = {}) {
        const p = window.Store.getWordProgress(wordId);
        p.reviews = (p.reviews || 0) + 1;
        p.recentUse = (p.recentUse || 0) + 1;
        // 在寫作中主動用上 -> 視為高品質複習（quality 4），並標記 usedInWriting
        if (opts.usedInWriting) {
            p.usedInWriting = (p.usedInWriting || 0) + 1;
            p.srs = window.SRS.reviewSrs(p.srs, 4);
        } else {
            p.srs = window.SRS.reviewSrs(p.srs, opts.quality != null ? opts.quality : 3);
        }
        window.Store.setWordProgress(wordId, p);
    },

    // 一次創作完成後，依「成功率」自動調節桃子高度（目標 ~85%）
    recordOutcome(outcome) {
        const settings = window.Store.loadSettings();
        const stats = window.Store.loadStats();
        stats.recentOutcomes = (stats.recentOutcomes || []).concat(outcome).slice(-10);
        stats.totalWorks = (stats.totalWorks || 0) + 1;
        window.Store.saveStats(stats);

        if (!settings.autoAdapt) return;

        // success: 是否輕鬆完成（用了足夠新詞且未求助過多）
        const successes = stats.recentOutcomes.filter(o => o.success).length;
        const rate = stats.recentOutcomes.length ? successes / stats.recentOutcomes.length : 0.85;

        if (stats.recentOutcomes.length >= 3) {
            if (rate > 0.9) {
                settings.reachDelta = Math.min(2.5, (settings.reachDelta || 1.2) + 0.15);
                settings.childLevel = Math.min(6, (settings.childLevel || 1.5) + 0.1);
            } else if (rate < 0.7) {
                settings.reachDelta = Math.max(0.5, (settings.reachDelta || 1.2) - 0.15);
            }
        }
        window.Store.saveSettings(settings);
    },

    // 衰減 recentUse（避免永久壓低某些詞）
    decayRecentUse() {
        const all = window.Store.loadProgress();
        Object.values(all).forEach(p => { if (p.recentUse) p.recentUse = Math.max(0, p.recentUse - 1); });
        window.Store.saveProgress(all);
    },
};

window.Adaptive = Adaptive;
