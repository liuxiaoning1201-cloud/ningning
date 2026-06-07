// ==================== SRS 間隔重複（SM-2，由 yueyu-learn/shared/srs.ts 移植） ====================
//
// 用戶對複習結果評分 0-5：
//   5 完美  4 好  3 勉強  2 有點難  1 錯  0 完全忘
// 評分 < 3 視為失敗，重新從 1 天間隔開始；≥ 3 視為通過，按公式延長間隔。

const DEFAULT_SRS = {
    repetitions: 0,
    easiness: 2.5,
    intervalDays: 0,
    dueAt: new Date().toISOString(),
};

function reviewSrs(prev, quality, now = new Date()) {
    const state = prev ? { ...prev } : { ...DEFAULT_SRS };

    let repetitions = state.repetitions;
    let easiness = state.easiness;
    let intervalDays = state.intervalDays;

    if (quality < 3) {
        repetitions = 0;
        intervalDays = 1;
    } else {
        repetitions += 1;
        if (repetitions === 1) intervalDays = 1;
        else if (repetitions === 2) intervalDays = 6;
        else intervalDays = Math.round(intervalDays * easiness);
    }

    easiness = Math.max(
        1.3,
        easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );

    const due = new Date(now.getTime() + intervalDays * 86400000);

    return {
        repetitions,
        easiness: Number(easiness.toFixed(2)),
        intervalDays,
        dueAt: due.toISOString(),
    };
}

function isDue(state, now = new Date()) {
    if (!state) return true;
    return new Date(state.dueAt).getTime() <= now.getTime();
}

// 學習階層：未見 -> 認得 -> 會意 -> 會用
// 由 SRS repetitions 與「在寫作中主動使用次數」共同決定
const STAGES = ['new', 'recognize', 'understand', 'produce'];

function stageFromProgress(progress) {
    if (!progress || progress.reviews === 0) return 'new';
    if (progress.usedInWriting >= 1) return 'produce';
    if (progress.srs && progress.srs.repetitions >= 2) return 'understand';
    return 'recognize';
}

window.SRS = { DEFAULT_SRS, reviewSrs, isDue, STAGES, stageFromProgress };
