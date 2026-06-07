// ==================== 主程式 ====================

const { ELEMENTS, ELEMENT_ORDER, SCENES } = window.LGMF_DATA;

const MODULES = {
    inspire:     { emoji: '🎲', title: '靈感魔方', badge: '入門', desc: '轉一轉，把六個元素串成有趣的故事。' },
    constraint:  { emoji: '🎯', title: '限制式創作', badge: '進階', desc: '挑戰必用詞，看你能寫出多妙的句子。' },
    relay:       { emoji: '🚂', title: '故事接龍', badge: '結構', desc: '起承轉合，一段一段把故事寫完整。' },
    picturebook: { emoji: '📖', title: '看圖繪本', badge: '成書', desc: '看圖寫話，生成插圖，做成自己的繪本。' },
};

const NAV = [
    { id: 'home', label: '首頁' },
    { id: 'inspire', label: '靈感魔方' },
    { id: 'constraint', label: '限制式創作' },
    { id: 'relay', label: '故事接龍' },
    { id: 'picturebook', label: '看圖繪本' },
    { id: 'diagnostic', label: '詞彙測驗' },
    { id: 'portfolio', label: '作品集' },
];

const App = {
    view: 'home',
    session: null,

    init() {
        this.renderTopnav();
        this.bindGlobal();
        window.Adaptive.decayRecentUse();
        this.go('home');
    },

    renderTopnav() {
        const nav = document.getElementById('topnav');
        nav.innerHTML = NAV.map(n => `<button data-go="${n.id}">${n.label}</button>`).join('');
    },

    bindGlobal() {
        document.body.addEventListener('click', (e) => {
            const go = e.target.closest('[data-go]');
            if (go) this.go(go.dataset.go);
        });
        // 設定
        document.getElementById('settingsBtn').onclick = () => this.openSettings();
        document.getElementById('closeSettings').onclick = () => this.modal('settingsModal', false);
        document.getElementById('btnExport').onclick = () => window.Store.exportVocabExcel();
        document.getElementById('btnTemplate').onclick = () => window.Store.downloadVocabTemplate();
        document.getElementById('btnImport').onclick = () => document.getElementById('fileImport').click();
        document.getElementById('fileImport').onchange = (e) => {
            if (e.target.files[0]) window.Store.importVocabExcel(e.target.files[0], (n, err) => {
                this.toast(err ? ('匯入失敗：' + err) : ('已匯入 ' + n + ' 個詞'));
            });
        };
        document.getElementById('btnReset').onclick = () => {
            if (confirm('確定要重置所有進度與作品嗎？')) {
                Object.values(window.Store.STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
                this.toast('已重置'); this.modal('settingsModal', false); this.go('home');
            }
        };
        // 完成慶祝
        document.getElementById('celebrateAgain').onclick = () => { this.overlay('celebrateOverlay', false); this.go(this.session ? this.session.mode : 'home'); };
        document.getElementById('celebrateBook').onclick = () => { this.overlay('celebrateOverlay', false); this.go('portfolio'); };
    },

    go(view, params) {
        if (this.session && this.session.cube) { this.session.cube.destroy(); }
        this.session = null;
        this.view = view;
        document.querySelectorAll('#topnav button').forEach(b => b.classList.toggle('active', b.dataset.go === view));
        const app = document.getElementById('app');
        app.scrollTop = 0; window.scrollTo(0, 0);
        if (view === 'home') return this.renderHome();
        if (view === 'diagnostic') return this.renderDiagnostic();
        if (view === 'portfolio') return this.renderPortfolio();
        if (view === 'reader') return this.renderReader(params);
        if (MODULES[view]) return this.startWriting(view);
        this.renderHome();
    },

    // ============ 首頁 ============
    renderHome() {
        const stats = this.vocabStats();
        const works = window.Store.loadWorks();
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="hero-banner">
                <h1>靈感魔方</h1>
                <p>看圖、轉魔方、組合靈感，自由創作屬於你的故事。一邊寫，一邊「跳一跳摘到桃子」，學會更多好詞好句！</p>
                <div class="hero-cube">🎲</div>
            </div>
            <div class="dash">
                <div class="panel">
                    <h3>📊 我的詞彙量</h3>
                    <div class="meter-row">
                        <div class="meter-num">${stats.produce + stats.understand}</div>
                        <div>
                            <div class="meter-label">已會用 / 學習中的詞</div>
                            <div class="meter-label">約相當於 ${this.levelLabel()} 水平</div>
                        </div>
                    </div>
                    <div class="bar"><i style="width:${Math.min(100, stats.knownPct)}%"></i></div>
                    <div class="stage-legend">
                        <span class="lg-pro">會用 ${stats.produce}</span>
                        <span class="lg-und">會意 ${stats.understand}</span>
                        <span class="lg-rec">認得 ${stats.recognize}</span>
                        <span class="lg-new">待學 ${stats.newCount}</span>
                    </div>
                    <button class="btn btn-ghost full" data-go="diagnostic" style="margin-top:16px">📝 做詞彙量測驗</button>
                </div>
                <div class="panel">
                    <h3>🌳 詞彙成長樹</h3>
                    <div class="tree-wrap">${this.treeSVG(stats.produce)}
                        <div class="tree-stats">
                            <div class="tree-stat"><b>${stats.produce}</b><span>摘到的桃子</span></div>
                            <div class="tree-stat"><b>${works.length}</b><span>完成的作品</span></div>
                            <div class="tree-stat"><b>${stats.totalWordsUsed}</b><span>用過的詞次</span></div>
                        </div>
                    </div>
                </div>
            </div>
            <h3 class="page-title" style="font-size:1.4rem">選一個玩法開始創作</h3>
            <div class="modules-grid">
                ${Object.entries(MODULES).map(([id, m]) => `
                    <div class="module-card" data-go="${id}">
                        <div class="m-badge">${m.badge}</div>
                        <div class="m-emoji">${m.emoji}</div>
                        <h4>${m.title}</h4>
                        <p>${m.desc}</p>
                    </div>`).join('')}
            </div>`;
    },

    // ============ 寫作版塊（共用） ============
    startWriting(mode) {
        const settings = window.Store.loadSettings();
        const scene = (mode === 'picturebook') ? null : this.randomScene();
        this.session = {
            mode, scene,
            slots: {}, candidates: new Map(),
            cube: null, requiredStretch: settings.requiredStretch != null ? settings.requiredStretch : 2,
            pages: [], relayStep: 0,
            challengeWords: [],
            builder: [], builderAI: null,
        };
        const m = MODULES[mode];
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="page-title">${m.emoji} ${m.title}</div>
            <div class="page-sub">${m.desc}</div>
            ${mode === 'picturebook' ? this.sceneChooserHTML() : ''}
            <div class="write-layout" id="writeLayout" ${mode === 'picturebook' ? 'style="display:none"' : ''}>
                <div class="left-col">
                    ${scene ? this.sceneCardHTML(scene) : '<div id="sceneSlot"></div>'}
                    <div id="cube-container"></div>
                    <div class="cube-hint">點一下詞語就放進故事 · 用方向鍵或拖曳轉動魔方看各面</div>
                    <div class="cube-controls">
                        <div class="dpad">
                            <button class="dbtn up" id="btnUp" title="往上轉">▲</button>
                            <button class="dbtn left" id="btnLeft" title="往左轉">◀</button>
                            <button class="dbtn center" disabled>🎲</button>
                            <button class="dbtn right" id="btnRight" title="往右轉">▶</button>
                            <button class="dbtn down" id="btnDown" title="往下轉">▼</button>
                        </div>
                        <button class="btn btn-ghost" id="btnRefill">🔄 換一批詞</button>
                    </div>
                    <div class="slots" id="slots"></div>
                </div>
                <div class="right-col">
                    ${mode === 'relay' ? this.relayStepsHTML() : ''}
                    ${mode === 'constraint' ? '<div class="challenge-bar"><div class="cb-title">今日挑戰：把這些新詞用進你的故事</div><div class="challenge-words" id="challengeWords"></div></div>' : ''}
                    <div class="prompt-line" id="promptLine"></div>
                    ${mode === 'relay' ? this.builderHTML() : ''}
                    <div class="writing-panel">
                        <input class="write-title-input" id="workTitle" placeholder="幫你的故事取個題目…">
                        <textarea class="write-area" id="writeArea" placeholder="開始寫吧！點魔方上的詞語可以放進故事裡。你也可以自由打字、調整詞語順序。"></textarea>
                        <div class="write-meta"><span id="wordCount">0 字</span><span id="usedInfo"></span></div>
                        <div class="ai-bar">
                            <button class="btn btn-primary" id="btnAIReview">👩‍🏫 請 AI 老師看看（語序・邏輯・建議）</button>
                        </div>
                        <div id="aiFeedback"></div>
                        <div class="drawer" id="drawer"><h4>🎒 詞語抽屜（點一下放進故事）</h4><div id="drawerBody"></div>
                            <div class="addword-row">
                                <input type="text" id="customWord" placeholder="自己想到的詞？打進去按 ＋" maxlength="12">
                                <button id="btnAddWord">＋ 加詞</button>
                            </div>
                        </div>
                        <div style="display:flex;gap:10px;margin-top:14px">
                            ${mode === 'picturebook'
                                ? '<button class="btn btn-accent" id="btnPageDone">🖼️ 完成這頁並生成插圖</button><button class="btn btn-primary" id="btnFinish">📕 完成繪本</button>'
                                : mode === 'relay'
                                    ? '<button class="btn btn-ghost" id="btnRelayNext">下一段 ›</button><button class="btn btn-primary" id="btnFinish" style="flex:1">✅ 完成創作</button>'
                                    : '<button class="btn btn-primary full" id="btnFinish">✅ 完成創作</button>'}
                        </div>
                        ${mode === 'picturebook' ? '<div class="write-meta"><span id="pageInfo">尚未完成任何頁</span></div>' : ''}
                    </div>
                </div>
            </div>`;

        if (mode === 'picturebook') {
            this.bindSceneChooser();
        } else {
            this.bootCube();
        }
    },

    bootCube() {
        const s = this.session;
        const container = document.getElementById('cube-container');
        s.cube = new window.Cube3D(container, (item) => this.handleWordPick(item));
        this.refillCube(true);
        if (s.mode === 'constraint') this.setupChallenge();

        document.getElementById('btnUp').onclick = () => s.cube.spin('up');
        document.getElementById('btnDown').onclick = () => s.cube.spin('down');
        document.getElementById('btnLeft').onclick = () => s.cube.spin('left');
        document.getElementById('btnRight').onclick = () => s.cube.spin('right');
        document.getElementById('btnRefill').onclick = () => this.refillCube();
        document.getElementById('writeArea').addEventListener('input', () => this.onTextInput());
        document.getElementById('btnFinish').onclick = () => this.finish();
        document.getElementById('btnAIReview').onclick = () => this.requestAIReview();
        document.getElementById('btnAddWord').onclick = () => this.addCustomWord();
        document.getElementById('customWord').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addCustomWord(); });
        if (s.mode === 'picturebook') document.getElementById('btnPageDone').onclick = () => this.finishPage();
        if (s.mode === 'relay') {
            document.getElementById('btnRelayNext').onclick = () => this.relayNext();
            document.getElementById('btnSelfCheck').onclick = () => this.builderSelfCheck();
            document.getElementById('btnAIPolish').onclick = () => this.builderAIPolish();
            document.getElementById('btnCommit').onclick = () => this.builderCommit();
            document.querySelectorAll('#connectives .ck').forEach(c => c.onclick = () => this.addBuilderChip(c.dataset.c));
            this.renderBuilder();
        }
        this.renderSlots();
        this.updatePromptLine();
        this.updateDrawer();
    },

    refillCube(silent) {
        const decks = {};
        ELEMENT_ORDER.forEach(el => { decks[el] = window.Adaptive.deckForElement(el, 9); });
        this.session.cube.fillFacesByElement(decks);
        // 收集新詞供抽屜參考
        this.session._lastDecks = decks;
        this.updateDrawer();
        if (!silent) this.toast('魔方換上新詞了！');
    },

    setupChallenge() {
        // 從新詞中挑 3 個挑戰詞（桃子）
        const all = [];
        Object.values(this.session._lastDecks || {}).forEach(deck => {
            deck.forEach(it => { if (it.stage === 'new') all.push(it); });
        });
        const shuffled = window.Adaptive.weightedShuffle(all).slice(0, 3);
        this.session.challengeWords = shuffled.map(it => it.word);
        const box = document.getElementById('challengeWords');
        if (box) box.innerHTML = this.session.challengeWords.map(w => `<span class="cw" data-w="${w.word}">${w.word}</span>`).join('');
    },

    handleWordPick(item) {
        const s = this.session;
        const showAndUse = () => {
            s.slots[item.element] = item;
            s.candidates.set(item.wordId, item);
            this.renderSlots();
            this.updatePromptLine();
            this.placeWord(item.word);
            this.updateDrawer();
            this.beep();
        };
        if (item.stage === 'new') {
            // 桃子：先彈例句鷹架，現學現用
            this.showWordCard(item, showAndUse);
        } else {
            showAndUse();
        }
    },

    showWordCard(item, onUse) {
        document.getElementById('wcTag').textContent = item.stage === 'new' ? '✨ 新詞挑戰' : '詞語';
        document.getElementById('wcWord').textContent = item.word;
        const settings = window.Store.loadSettings();
        document.getElementById('wcPinyin').textContent = settings.showPinyin && item.pinyin ? item.pinyin : '';
        document.getElementById('wcExample').textContent = item.example ? ('例：' + item.example) : '試試把它放進你的故事裡吧！';
        this.modal('wordCard', true);
        document.getElementById('wcUse').onclick = () => { this.modal('wordCard', false); onUse(); };
        document.getElementById('wcCancel').onclick = () => this.modal('wordCard', false);
    },

    // 放置一個詞：故事接龍 → 進入「句子建構區」；其他版塊 → 直接插入打字框
    placeWord(word) {
        if (this.session.mode === 'relay') this.addBuilderChip(word);
        else this.insertText(word);
    },

    insertText(word) {
        const ta = document.getElementById('writeArea');
        const start = ta.selectionStart || ta.value.length;
        ta.value = ta.value.slice(0, start) + word + ta.value.slice(ta.selectionEnd || ta.value.length);
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + word.length;
        this.onTextInput();
    },

    onTextInput() {
        const text = document.getElementById('writeArea').value;
        document.getElementById('wordCount').textContent = text.replace(/\s/g, '').length + ' 字';
        // 限制式：偵測挑戰詞
        if (this.session.mode === 'constraint') {
            document.querySelectorAll('#challengeWords .cw').forEach(el => {
                el.classList.toggle('done', text.includes(el.dataset.w));
            });
        }
        // 抽屜中已用的詞變淡
        document.querySelectorAll('#drawerBody .chip').forEach(c => {
            c.classList.toggle('used', text.includes(c.dataset.w));
        });
    },

    renderSlots() {
        const box = document.getElementById('slots');
        if (!box) return;
        box.innerHTML = ELEMENT_ORDER.map(el => {
            const e = ELEMENTS[el];
            const filled = this.session.slots[el];
            return `<div class="slot ${filled ? 'filled' : ''}" data-el="${el}">
                <span class="slot-label">${e.emoji} ${e.slotLabel}</span>
                <span class="slot-word">${filled ? filled.word : '—'}</span></div>`;
        }).join('');
    },

    updatePromptLine() {
        const box = document.getElementById('promptLine');
        if (!box) return;
        const s = this.session.slots;
        const g = (el, ph) => s[el] ? `<b>${s[el].word}</b>` : `（${ph}）`;
        if (this.session.mode === 'relay') {
            const tips = ['開頭：交代時間、地點、人物', '發展：發生了甚麼事', '轉折：遇到困難或意外', '結局：最後怎麼樣，心情如何'];
            box.innerHTML = `提示句型 → ${tips[this.session.relayStep]}`;
            return;
        }
        box.innerHTML = `提示句型 → ${g('when', '甚麼時候')}，${g('who', '誰')}在${g('where', '哪裡')}${g('event', '做甚麼')}，覺得很${g('emotion', '心情')}。可以用上 ${g('descriptor', '好詞')} 讓句子更生動！`;
    },

    updateDrawer() {
        const body = document.getElementById('drawerBody');
        if (!body) return;
        const settings = window.Store.loadSettings();
        const text = (document.getElementById('writeArea') || {}).value || '';
        const decks = this.session._lastDecks || {};
        const custom = this.session.customWords || [];
        const customHTML = custom.length
            ? `<div class="drawer-group"><div class="dg-title">📝 我自己加的詞</div><div class="chips">${
                custom.map(w => `<span class="chip custom ${text.includes(w) ? 'used' : ''}" data-w="${w}" data-custom="1">${w}<span class="chip-x" data-del="${w}">×</span></span>`).join('')
            }</div></div>` : '';
        body.innerHTML = customHTML + ELEMENT_ORDER.map(el => {
            const e = ELEMENTS[el];
            const items = (decks[el] || []).slice(0, 6);
            if (!items.length) return '';
            return `<div class="drawer-group"><div class="dg-title">${e.emoji} ${e.label}</div><div class="chips">${
                items.map(it => {
                    const py = settings.showPinyin && it.word.pinyin ? `<span class="chip-py">${it.word.pinyin}</span>` : '';
                    return `<span class="chip ${it.stage === 'new' ? 'stretch' : ''} ${text.includes(it.word.word) ? 'used' : ''}" data-w="${it.word.word}" data-id="${it.word.id}">${it.word.word}${py}</span>`;
                }).join('')
            }</div></div>`;
        }).join('');
        body.querySelectorAll('.chip').forEach(chip => {
            chip.onclick = (e) => {
                // 刪除自訂詞
                if (e.target.dataset.del) {
                    this.session.customWords = (this.session.customWords || []).filter(w => w !== e.target.dataset.del);
                    this.updateDrawer();
                    return;
                }
                if (chip.dataset.custom) { this.placeWord(chip.dataset.w); return; }
                const id = chip.dataset.id;
                const item = this.findItem(id);
                if (item && item.stage === 'new') {
                    this.showWordCard(this.toCardItem(item), () => { this.recordCandidate(item); this.placeWord(item.word.word); });
                } else {
                    this.recordCandidate(item); this.placeWord(chip.dataset.w);
                }
            };
        });
    },

    addCustomWord() {
        const input = document.getElementById('customWord');
        if (!input) return;
        const w = (input.value || '').trim();
        if (!w) return;
        this.session.customWords = this.session.customWords || [];
        if (!this.session.customWords.includes(w)) this.session.customWords.unshift(w);
        input.value = '';
        this.placeWord(w);
        this.updateDrawer();
    },

    // ============ AI 老師回饋 ============
    async requestAIReview() {
        const text = (document.getElementById('writeArea').value || '').trim();
        const box = document.getElementById('aiFeedback');
        if (text.replace(/\s/g, '').length < 4) { this.toast('先寫一兩句，AI 老師才看得出來喔'); return; }
        const btn = document.getElementById('btnAIReview');
        btn.disabled = true;
        box.innerHTML = `<div class="ai-feedback"><div class="aif-head"><div class="aif-avatar">👩‍🏫</div>
            <div class="aif-title">AI 老師正在閱讀你的故事<span class="ai-loading"></span></div></div></div>`;
        try {
            const fb = await window.AITeacher.review(text);
            if (!fb) throw new Error('解析失敗');
            this.renderAIFeedback(fb);
        } catch (e) {
            const offline = (e && e.message === 'llm_not_configured');
            box.innerHTML = `<div class="ai-feedback"><div class="aif-head"><div class="aif-avatar">👩‍🏫</div>
                <div class="aif-title">AI 老師暫時休息中</div></div>
                <div class="aif-overall">${offline ? 'AI 回饋服務尚未開通（伺服器未設定 DeepSeek 金鑰）。你仍可以自由創作與生成插圖。' : '連線好像出了點問題，待會再試試看。'}</div></div>`;
        } finally {
            btn.disabled = false;
        }
    },

    renderAIFeedback(fb) {
        const box = document.getElementById('aiFeedback');
        const score = Math.max(1, Math.min(5, Number(fb.score) || 3));
        const sents = Array.isArray(fb.sentences) ? fb.sentences : [];
        const sentHTML = sents.map(s => {
            const warn = s.ok === false || (s.issue && s.issue.trim());
            return `<div class="aif-sent ${warn ? 'warn' : ''}">
                <div class="aif-orig">「${s.original || ''}」</div>
                ${warn && s.issue ? `<div class="aif-issue">⚠️ ${s.issue}</div>` : '<div class="aif-issue" style="color:#1f9d57">✓ 這句寫得通順</div>'}
                ${s.suggestion && s.suggestion.trim() ? `<div class="aif-fix">💡 試試：<b>${s.suggestion}</b></div>` : ''}
            </div>`;
        }).join('');
        box.innerHTML = `<div class="ai-feedback">
            <div class="aif-head"><div class="aif-avatar">👩‍🏫</div>
                <div class="aif-title">AI 老師的回饋</div>
                <div class="aif-score">${'⭐'.repeat(score)}${'☆'.repeat(5 - score)}</div></div>
            <div class="aif-overall">${fb.overall || ''}</div>
            ${sentHTML}
            <div class="aif-cheer">💗 ${fb.encouragement || '繼續加油，你寫得很棒！'}</div>
        </div>`;
    },

    findItem(id) {
        const decks = this.session._lastDecks || {};
        for (const el of ELEMENT_ORDER) {
            const found = (decks[el] || []).find(it => it.word.id === id);
            if (found) return found;
        }
        return null;
    },
    toCardItem(it) {
        return { wordId: it.word.id, word: it.word.word, element: it.word.element, stage: it.stage, example: it.word.example, pinyin: it.word.pinyin };
    },
    recordCandidate(it) {
        if (it) this.session.candidates.set(it.word.id, this.toCardItem(it));
    },

    // 故事接龍：推進到下一步
    relayNext() {
        if (this.session.relayStep < 3) {
            this.session.relayStep++;
            this.renderRelaySteps();
            this.updatePromptLine();
            this.refillCube();
        }
    },
    relayStepsHTML() {
        const names = ['起', '承', '轉', '合'];
        return `<div class="relay-steps">${names.map((n, i) => `<div class="relay-step ${i === 0 ? 'active' : ''}" data-step="${i}">${n}</div>`).join('')}</div>`;
    },
    renderRelaySteps() {
        document.querySelectorAll('.relay-step').forEach((el, i) => {
            el.classList.toggle('active', i === this.session.relayStep);
            el.classList.toggle('done', i < this.session.relayStep);
        });
    },

    // ============ 故事接龍：拖拽造句 + 自我優化 + AI 採納互動 ============
    builderHTML() {
        const conns = ['然後', '接著', '因為', '所以', '可是', '於是', '終於', '忽然', '後來', '而且'];
        return `<div class="builder-card">
            <div class="bc-title">🧩 把詞語排成一句通順的話</div>
            <div class="bc-sub">點魔方或下面的詞語加進來，<b>按住詞語左右拖動</b>可以調整順序，點 × 可刪除。</div>
            <div class="builder" id="builder"></div>
            <div class="builder-preview" id="builderPreview"></div>
            <div class="connectives" id="connectives">
                <span class="ck-title">🔗 連接詞：</span>
                ${conns.map(c => `<span class="ck" data-c="${c}">${c}</span>`).join('')}
            </div>
            <div class="builder-actions">
                <button class="btn btn-ghost" id="btnSelfCheck">🔍 自我檢查</button>
                <button class="btn btn-accent" id="btnAIPolish">🤖 給 AI 老師潤色</button>
                <button class="btn btn-primary" id="btnCommit">✅ 加進故事</button>
            </div>
            <div id="builderChat"></div>
        </div>`;
    },

    addBuilderChip(word) {
        if (!word) return;
        this.session.builder.push(word);
        this.beep();
        this.renderBuilder();
    },

    builderText() { return this.session.builder.join(''); },

    renderBuilder() {
        const box = document.getElementById('builder');
        if (!box) return;
        const arr = this.session.builder;
        box.innerHTML = arr.length
            ? arr.map((w, i) => `<span class="bchip" draggable="true" data-i="${i}">${w}<span class="bx" data-del="${i}">×</span></span>`).join('')
            : '<span class="builder-empty">（這裡會排出你的句子…）</span>';
        const prev = document.getElementById('builderPreview');
        if (prev) prev.textContent = arr.length ? ('你的句子：' + this.builderText()) : '';

        // 刪除
        box.querySelectorAll('.bx').forEach(x => x.onclick = (e) => {
            e.stopPropagation();
            this.session.builder.splice(Number(x.dataset.del), 1);
            this.renderBuilder();
        });
        // 拖拽排序
        let dragFrom = null;
        box.querySelectorAll('.bchip').forEach(chip => {
            chip.addEventListener('dragstart', (e) => { dragFrom = Number(chip.dataset.i); chip.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
            chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
            chip.addEventListener('dragover', (e) => { e.preventDefault(); chip.classList.add('drop-target'); });
            chip.addEventListener('dragleave', () => chip.classList.remove('drop-target'));
            chip.addEventListener('drop', (e) => {
                e.preventDefault();
                chip.classList.remove('drop-target');
                const to = Number(chip.dataset.i);
                if (dragFrom === null || dragFrom === to) return;
                const arr2 = this.session.builder;
                const [moved] = arr2.splice(dragFrom, 1);
                arr2.splice(to, 0, moved);
                dragFrom = null;
                this.renderBuilder();
            });
        });
    },

    builderSelfCheck() {
        const text = this.builderText();
        const chat = document.getElementById('builderChat');
        if (text.replace(/\s/g, '').length < 2) { this.toast('先排幾個詞再檢查喔'); return; }
        const conns = ['然後', '接著', '因為', '所以', '可是', '但是', '於是', '終於', '忽然', '後來', '而且', '雖然', '一邊', '正在'];
        const hasConn = conns.some(c => text.includes(c));
        const tips = [];
        if (!hasConn) tips.push('你的句子裡好像沒有<b>連接詞</b>（像「然後、因為、所以」）。加一個會更通順！');
        if (this.session.builder.length < 3) tips.push('句子有點短，試著再加一兩個詞，把<b>時間、地點、心情</b>補上去。');
        if (!tips.length) tips.push('句子結構看起來不錯！可以再唸一遍，或交給 AI 老師潤色看看。');
        chat.innerHTML = `<div class="bchat">
            <div class="bubble bubble-self">${text}</div>
            <div class="bubble bubble-tip"><b>自我檢查</b><ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul></div>
        </div>`;
    },

    async builderAIPolish() {
        const text = this.builderText();
        if (text.replace(/\s/g, '').length < 2) { this.toast('先排幾個詞，AI 才幫得上忙'); return; }
        const chat = document.getElementById('builderChat');
        chat.innerHTML = `<div class="bchat">
            <div class="bubble bubble-self">${text}</div>
            <div class="bubble bubble-ai"><span class="ai-loading">AI 老師思考中</span></div>
        </div>`;
        try {
            const res = await window.AITeacher.polishSentence(text);
            if (!res || !res.suggestion) throw new Error('no');
            this.session.builderAI = res.suggestion;
            chat.innerHTML = `<div class="bchat">
                <div class="bubble bubble-self">${text}</div>
                <div class="bubble bubble-ai">
                    <div class="ai-name">👩‍🏫 AI 老師建議</div>
                    <div class="ai-sugg">「${res.suggestion}」</div>
                    ${res.reason ? `<div class="ai-reason">💡 ${res.reason}</div>` : ''}
                    <div class="ai-choose">
                        <button class="btn btn-primary" id="btnAdopt">採納這個寫法</button>
                        <button class="btn btn-ghost" id="btnReject">用我自己的</button>
                    </div>
                </div></div>`;
            document.getElementById('btnAdopt').onclick = () => this.builderAdopt(res.suggestion);
            document.getElementById('btnReject').onclick = () => this.builderReject();
        } catch (e) {
            const offline = (e && e.message === 'llm_not_configured');
            chat.innerHTML = `<div class="bchat"><div class="bubble bubble-self">${text}</div>
                <div class="bubble bubble-ai">${offline ? 'AI 老師服務尚未開通，你可以先用自己的句子。' : 'AI 老師暫時連不上，待會再試。'}</div></div>`;
        }
    },

    builderAdopt(suggestion) {
        // 採納：把建構區換成 AI 的句子（拆成單一整句 chip，仍可再編輯刪改）
        this.session.builder = [suggestion];
        this.session.builderAI = null;
        this.renderBuilder();
        const chat = document.getElementById('builderChat');
        chat.innerHTML = `<div class="bchat"><div class="bubble bubble-tip">✅ 已採納 AI 老師的寫法，按「加進故事」就完成這一句。</div></div>`;
        this.toast('已採納，記得加進故事');
    },

    builderReject() {
        this.session.builderAI = null;
        const chat = document.getElementById('builderChat');
        chat.innerHTML = `<div class="bchat"><div class="bubble bubble-tip">👍 保留你自己的句子，很有主見！按「加進故事」即可。</div></div>`;
    },

    builderCommit() {
        let sentence = this.builderText().trim();
        if (sentence.replace(/\s/g, '').length < 2) { this.toast('句子太短，再排幾個詞吧'); return; }
        if (!/[。！？…]$/.test(sentence)) sentence += '。';
        const ta = document.getElementById('writeArea');
        ta.value = (ta.value ? ta.value + '' : '') + sentence;
        // 清空建構區，準備下一句
        this.session.builder = [];
        this.session.builderAI = null;
        this.renderBuilder();
        document.getElementById('builderChat').innerHTML = '';
        this.onTextInput();
        this.toast('這一句加進故事了！');
    },

    // ============ 看圖繪本：選場景 + 多頁 ============
    sceneChooserHTML() {
        return `<div id="sceneChooser"><h3 class="page-title" style="font-size:1.2rem">先選一張圖開始</h3>
            <div class="modules-grid">${SCENES.map(sc => `
                <div class="module-card" data-scene="${sc.id}">
                    <div class="scene-card" style="height:120px;background:linear-gradient(135deg,${sc.gradient[0]},${sc.gradient[1]})">
                        <div class="scene-emojis">${sc.emojis.join('')}</div>
                    </div>
                    <h4 style="margin-top:10px">${sc.title}</h4>
                </div>`).join('')}</div></div>`;
    },
    bindSceneChooser() {
        document.querySelectorAll('[data-scene]').forEach(card => {
            card.onclick = () => {
                const sc = SCENES.find(s => s.id === card.dataset.scene);
                this.session.scene = sc;
                document.getElementById('sceneChooser').style.display = 'none';
                const layout = document.getElementById('writeLayout');
                layout.style.display = '';
                document.getElementById('sceneSlot').outerHTML = this.sceneCardHTML(sc);
                this.bootCube();
            };
        });
    },
    sceneCardHTML(sc) {
        return `<div class="scene-card" style="background:linear-gradient(135deg,${sc.gradient[0]},${sc.gradient[1]})">
            <div class="scene-emojis">${sc.emojis.join('')}</div>
            <div class="scene-title">${sc.title}</div></div>`;
    },

    async finishPage() {
        const text = document.getElementById('writeArea').value.trim();
        if (!text) { this.toast('先寫幾句話再生成插圖喔'); return; }
        this.showGenOverlay('正在為這一頁畫插圖…');
        const result = await window.ImageGen.generate(this.session.slots, this.session.scene, text);
        this.hideGenOverlay();
        this.session.pages.push({ pageId: 'p_' + (this.session.pages.length + 1), text, imageUrl: result.imageUrl, imagePrompt: result.prompt, usedWords: this.collectUsedIds(text) });
        document.getElementById('writeArea').value = '';
        document.getElementById('pageInfo').textContent = `已完成 ${this.session.pages.length} 頁`;
        this.onTextInput();
        this.refillCube();
        this.toast('這一頁完成了！可以繼續下一頁或完成繪本');
    },

    // ============ 完成 ============
    collectUsedIds(text) {
        const ids = [];
        this.session.candidates.forEach((item, id) => { if (text.includes(item.word)) ids.push(id); });
        // 也計入 slot 詞
        Object.values(this.session.slots).forEach(it => { if (text.includes(it.word) && !ids.includes(it.wordId)) ids.push(it.wordId); });
        return ids;
    },

    // ---- 生圖等待動畫 ----
    showGenOverlay(title) {
        const t = document.getElementById('genTitle');
        if (t) t.textContent = title || '正在為你的故事畫插圖…';
        document.getElementById('genProgress').textContent = '';
        this.overlay('genOverlay', true);
    },
    updateGen(done, total) {
        const p = document.getElementById('genProgress');
        if (p) p.textContent = `第 ${Math.min(done + 1, total)} / ${total} 句`;
    },
    hideGenOverlay() { this.overlay('genOverlay', false); },

    async finish() {
        const s = this.session;
        const title = (document.getElementById('workTitle').value || '').trim() || '我的故事';
        const text = document.getElementById('writeArea').value.trim();

        // ── 先驗證，避免白白呼叫生圖 ──
        if (s.mode === 'picturebook') {
            if (text) await this.finishPage();
            if (!s.pages.length) { this.toast('至少完成一頁繪本'); return; }
        } else {
            if (text.replace(/\s/g, '').length < 10) { this.toast('再多寫幾句，故事會更精彩！'); return; }
            if (s.mode === 'constraint') {
                const missing = s.challengeWords.filter(w => !text.includes(w.word));
                if (missing.length) { this.toast('還差挑戰詞：' + missing.map(w => w.word).join('、')); return; }
            }
        }

        // ── 生成插圖（每句一張，含等待動畫） ──
        let pages;
        if (s.mode === 'picturebook') {
            pages = s.pages.slice();
        } else {
            this.showGenOverlay('正在為你的故事畫插圖…');
            const generated = await window.ImageGen.generatePages(text, s.slots, s.scene, (done, total) => this.updateGen(done, total));
            this.hideGenOverlay();
            pages = generated.map((p, i) => ({
                pageId: 'p_' + (i + 1), text: p.text, imageUrl: p.imageUrl,
                imagePrompt: p.imagePrompt, usedWords: this.collectUsedIds(p.text),
            }));
        }

        // ── 計分（唯讀，收藏時才真正寫入 SRS / 統計） ──
        const usedIds = [...new Set(pages.flatMap(p => p.usedWords))];
        let score = 0, stretchUsed = 0;
        usedIds.forEach(id => {
            const item = s.candidates.get(id) || Object.values(s.slots).find(x => x.wordId === id);
            const stage = item ? item.stage : 'recognize';
            score += window.Adaptive.scoreWord(stage);
            if (stage === 'new') stretchUsed++;
        });
        const totalChars = pages.reduce((a, p) => a + p.text.replace(/\s/g, '').length, 0);
        const stars = this.calcStars(stretchUsed, totalChars, score);
        const success = stretchUsed >= (s.requiredStretch || 0) && totalChars >= 15;

        const work = {
            id: 'story_' + Date.now(), mode: s.mode, title, pages,
            createdAt: new Date().toISOString(), wordCount: totalChars,
            usedWordIds: usedIds, starsEarned: stars,
        };

        this.showResultPreview(work, { usedIds, stretchUsed, totalChars, success, stars });
    },

    // ── 成果預覽：先給看圖，再讓學生「收藏到寫作簿」 ──
    showResultPreview(work, meta) {
        const body = document.getElementById('resultBody');
        body.innerHTML = work.pages.map(p => `
            <div class="rp-card">
                <img src="${p.imageUrl}" alt="插圖">
                <div class="rp-text">${p.text}</div>
            </div>`).join('');
        document.getElementById('resultTitle').textContent = `🎨 「${work.title}」插畫完成！`;
        this.overlay('resultOverlay', true);
        document.getElementById('resultCollect').onclick = () => { this.overlay('resultOverlay', false); this.collectWork(work, meta); };
        document.getElementById('resultBack').onclick = () => { this.overlay('resultOverlay', false); this.toast('可以再修改，改好按「完成」會重新生成插圖'); };
    },

    collectWork(work, meta) {
        // 真正寫入：作品集 + SRS + 統計
        meta.usedIds.forEach(id => window.Adaptive.recordUse(id, { usedInWriting: true }));
        window.Store.addWork(work);
        const stats = window.Store.loadStats();
        stats.totalWordsUsed = (stats.totalWordsUsed || 0) + meta.usedIds.length;
        window.Store.saveStats(stats);
        window.Adaptive.recordOutcome({ success: meta.success, stretchUsed: meta.stretchUsed, chars: meta.totalChars, at: Date.now() });

        document.getElementById('celebrateTitle').textContent = work.title + ' · 已收藏！';
        document.getElementById('celebrateStars').textContent = '⭐'.repeat(meta.stars) + '☆'.repeat(3 - meta.stars);
        const fruit = meta.stretchUsed > 0 ? `你摘到了 ${meta.stretchUsed} 個新詞桃子 🍑` : '繼續嘗試新詞，可以摘到桃子喔！';
        document.getElementById('celebrateDetail').innerHTML = `全文 ${meta.totalChars} 字，用了 ${meta.usedIds.length} 個詞。<br>${fruit}<br>已收藏到「我的寫作簿」📒`;
        this.overlay('celebrateOverlay', true);
    },

    calcStars(stretchUsed, chars, score) {
        let stars = 1;
        if (chars >= 25 && stretchUsed >= 1) stars = 2;
        if (chars >= 40 && stretchUsed >= 2) stars = 3;
        if (score >= 20) stars = 3;
        return stars;
    },

    // ============ 詞彙診斷測驗 ============
    renderDiagnostic() {
        const words = window.Store.getAllWords();
        // 各難度抽 1-2 個，共約 8 題
        const byDiff = {};
        words.forEach(w => { (byDiff[w.difficulty] = byDiff[w.difficulty] || []).push(w); });
        const quiz = [];
        Object.keys(byDiff).sort((a, b) => a - b).forEach(d => {
            const pool = byDiff[d].sort(() => Math.random() - 0.5);
            quiz.push(...pool.slice(0, 2));
        });
        this.quiz = { items: quiz.slice(0, 8), idx: 0, known: [] };
        this.renderQuizCard();
    },

    renderQuizCard() {
        const q = this.quiz;
        const app = document.getElementById('app');
        if (q.idx >= q.items.length) return this.finishDiagnostic();
        const w = q.items[q.idx];
        app.innerHTML = `
            <div class="page-title">📝 詞彙量測驗</div>
            <div class="page-sub">看看這些詞你認不認識，我們會幫你找到「跳一跳摘得到」的難度。</div>
            <div class="quiz-card">
                <div class="quiz-progress">第 ${q.idx + 1} / ${q.items.length} 題</div>
                <div class="quiz-word">${w.word}</div>
                <div class="meter-label">${w.pinyin || ''}</div>
                <div class="quiz-faces">
                    <button data-k="yes" class="face face-yes"><span class="face-emoji">😊</span><span class="face-label">認識</span></button>
                    <button data-k="maybe" class="face face-maybe"><span class="face-emoji">😐</span><span class="face-label">好像見過</span></button>
                    <button data-k="no" class="face face-no"><span class="face-emoji">☹️</span><span class="face-label">不認識</span></button>
                </div>
            </div>`;
        app.querySelectorAll('.quiz-faces button').forEach(b => {
            b.onclick = () => this.answerQuiz(w, b.dataset.k);
        });
    },

    answerQuiz(word, k) {
        if (k === 'yes' || k === 'maybe') {
            this.quiz.known.push(word.difficulty);
            const p = window.Store.getWordProgress(word.id);
            p.reviews = (p.reviews || 0) + 1;
            p.srs = window.SRS.reviewSrs(p.srs, k === 'yes' ? 4 : 3);
            if (k === 'yes') p.usedInWriting = Math.max(p.usedInWriting || 0, 0);
            window.Store.setWordProgress(word.id, p);
        }
        this.quiz.idx++;
        this.renderQuizCard();
    },

    finishDiagnostic() {
        const known = this.quiz.known;
        // 估計：已知詞的平均難度 + 0.7 當作桃子起點
        const level = known.length ? (known.reduce((a, b) => a + b, 0) / known.length + 0.4) : 1.5;
        const settings = window.Store.loadSettings();
        settings.childLevel = Math.max(1, Math.min(6, Number(level.toFixed(2))));
        window.Store.saveSettings(settings);
        const estWords = Math.round(settings.childLevel / 6 * 1800);
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="quiz-card">
                <div class="celebrate-emoji" style="font-size:3rem">🎯</div>
                <h2 style="font-family:'Noto Serif TC',serif;margin:12px 0">測驗完成！</h2>
                <div class="celebrate-detail">你目前約相當於 <b>${this.levelLabel()}</b> 水平，<br>估計掌握約 <b>${estWords}</b> 個常用詞。<br>魔方會幫你準備「剛剛好」的新詞挑戰。</div>
                <div style="display:flex;gap:10px;margin-top:18px">
                    <button class="btn btn-ghost" data-go="home" style="flex:1">回首頁</button>
                    <button class="btn btn-primary" data-go="inspire" style="flex:1">開始創作 🎲</button>
                </div>
            </div>`;
    },

    // ============ 作品集 ============
    renderPortfolio() {
        const works = window.Store.loadWorks();
        const app = document.getElementById('app');
        if (!works.length) {
            app.innerHTML = `<div class="page-title">📚 我的作品集</div>
                <div class="empty-state"><div class="es-emoji">📖</div><p>還沒有作品，快去創作你的第一個故事吧！</p>
                <button class="btn btn-primary" data-go="inspire" style="margin-top:18px">開始創作</button></div>`;
            return;
        }
        app.innerHTML = `<div class="page-title">📚 我的作品集</div>
            <div class="page-sub">共 ${works.length} 本 · 點開可翻頁閱讀與朗讀</div>
            <div class="shelf">${works.map(w => `
                <div class="book" data-work="${w.id}">
                    <div class="book-cover" style="background-image:url('${(w.pages[0] && w.pages[0].imageUrl) || ''}')"></div>
                    <div class="book-info"><h4>${w.title}</h4>
                        <div class="bi-meta"><span>${MODULES[w.mode] ? MODULES[w.mode].title : w.mode}</span><span>${'⭐'.repeat(w.starsEarned || 1)}</span></div>
                    </div>
                </div>`).join('')}</div>`;
        app.querySelectorAll('.book').forEach(b => b.onclick = () => this.go('reader', b.dataset.work));
    },

    renderReader(workId) {
        const work = window.Store.loadWorks().find(w => w.id === workId);
        if (!work) return this.go('portfolio');
        this.reader = { work, page: 0 };
        this.renderReaderPage();
    },

    renderReaderPage() {
        const { work, page } = this.reader;
        const p = work.pages[page];
        const app = document.getElementById('app');
        app.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div class="page-title" style="margin:0">${work.title}</div>
                <button class="btn btn-ghost" data-go="portfolio">← 返回書架</button>
            </div>
            <div class="reader-stage"><div class="book-page" id="bookPage">
                <img class="bp-image" src="${p.imageUrl}" alt="插圖">
                <div class="bp-text">${p.text}</div>
            </div></div>
            <div class="reader-controls">
                <button class="btn btn-ghost" id="rPrev" ${page === 0 ? 'disabled' : ''}>‹ 上一頁</button>
                <span class="pageno">${page + 1} / ${work.pages.length}</span>
                <button class="btn btn-ghost" id="rNext" ${page >= work.pages.length - 1 ? 'disabled' : ''}>下一頁 ›</button>
                <button class="btn btn-accent" id="rRead">🔊 朗讀</button>
                <button class="btn btn-ghost" id="rPrint">🖨️ 列印 / 存 PDF</button>
                <button class="btn btn-ghost" id="rDel">🗑️ 刪除</button>
            </div>`;
        document.getElementById('rPrev').onclick = () => { if (this.reader.page > 0) { this.reader.page--; this.flipAndRender(); } };
        document.getElementById('rNext').onclick = () => { if (this.reader.page < work.pages.length - 1) { this.reader.page++; this.flipAndRender(); } };
        document.getElementById('rRead').onclick = () => this.speak(p.text);
        document.getElementById('rPrint').onclick = () => this.printBook(work);
        document.getElementById('rDel').onclick = () => { if (confirm('刪除這本作品？')) { window.Store.deleteWork(work.id); this.go('portfolio'); } };
    },

    flipAndRender() {
        const page = document.getElementById('bookPage');
        if (page) { page.classList.add('flip'); setTimeout(() => this.renderReaderPage(), 250); }
        else this.renderReaderPage();
    },

    speak(text) {
        if (!window.speechSynthesis) { this.toast('此瀏覽器不支援朗讀'); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const v = voices.find(v => /zh-HK|yue/i.test(v.lang)) || voices.find(v => /zh/i.test(v.lang));
        if (v) u.voice = v;
        u.lang = v ? v.lang : 'zh-HK';
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
    },

    printBook(work) {
        const win = window.open('', '_blank');
        const html = `<html><head><title>${work.title}</title><style>
            body{font-family:"Noto Serif TC",serif;padding:30px;color:#2a2f3a}
            h1{text-align:center} .pg{page-break-inside:avoid;margin-bottom:30px;text-align:center}
            img{max-width:90%;border-radius:12px} p{font-size:18px;line-height:2;text-align:left;max-width:680px;margin:14px auto}
            </style></head><body><h1>${work.title}</h1>
            ${work.pages.map((p, i) => `<div class="pg"><img src="${p.imageUrl}"><p>${p.text}</p></div>`).join('')}
            </body></html>`;
        win.document.write(html); win.document.close();
        setTimeout(() => win.print(), 500);
    },

    // ============ 工具 ============
    vocabStats() {
        const all = window.Store.getAllWords();
        const prog = window.Store.loadProgress();
        let produce = 0, understand = 0, recognize = 0, newCount = 0;
        all.forEach(w => {
            const stage = window.SRS.stageFromProgress(prog[w.id]);
            if (stage === 'produce') produce++;
            else if (stage === 'understand') understand++;
            else if (stage === 'recognize') recognize++;
            else newCount++;
        });
        const stats = window.Store.loadStats();
        const known = produce + understand + recognize;
        return { produce, understand, recognize, newCount, total: all.length,
            knownPct: Math.round(known / all.length * 100), totalWordsUsed: stats.totalWordsUsed || 0 };
    },

    levelLabel() {
        const lv = window.Store.loadSettings().childLevel || 1.5;
        const names = ['', '小一', '小二', '小三', '小四', '小五', '小六'];
        return names[Math.max(1, Math.min(6, Math.round(lv)))];
    },

    treeSVG(fruit) {
        const n = Math.min(12, fruit);
        let fruits = '';
        for (let i = 0; i < n; i++) {
            const x = 40 + (i % 4) * 40 + (Math.floor(i / 4) % 2) * 20;
            const y = 50 + Math.floor(i / 4) * 34;
            fruits += `<circle cx="${x}" cy="${y}" r="9" fill="#ff8a5c"/><circle cx="${x - 3}" cy="${y - 3}" r="2.5" fill="#fff" opacity=".6"/>`;
        }
        return `<svg viewBox="0 0 200 200" width="180" height="180">
            <ellipse cx="100" cy="80" rx="78" ry="62" fill="#7dd87d" opacity=".85"/>
            <ellipse cx="60" cy="70" rx="42" ry="36" fill="#8fe28f" opacity=".7"/>
            <ellipse cx="140" cy="72" rx="44" ry="38" fill="#8fe28f" opacity=".7"/>
            <rect x="92" y="120" width="16" height="60" rx="6" fill="#9b6b43"/>
            <g transform="translate(30,30)">${fruits}</g>
        </svg>`;
    },

    randomScene() { return SCENES[Math.floor(Math.random() * SCENES.length)]; },

    modal(id, on) { document.getElementById(id).classList.toggle('active', on); },
    overlay(id, on) { document.getElementById(id).classList.toggle('active', on); },

    openSettings() {
        const s = window.Store.loadSettings();
        document.getElementById('setIntensity').value = s.challengeIntensity;
        document.getElementById('setRequired').value = s.requiredStretchPerStory;
        document.getElementById('setPinyin').checked = s.showPinyin;
        document.getElementById('setAuto').checked = s.autoAdapt;
        document.getElementById('setStyle').value = s.imageStyle || 'storybook';
        document.getElementById('setEndpoint').value = s.imageEndpoint || '';
        this.modal('settingsModal', true);
        const save = () => {
            s.challengeIntensity = document.getElementById('setIntensity').value;
            s.requiredStretchPerStory = Number(document.getElementById('setRequired').value);
            s.requiredStretch = s.requiredStretchPerStory;
            s.showPinyin = document.getElementById('setPinyin').checked;
            s.autoAdapt = document.getElementById('setAuto').checked;
            s.imageStyle = document.getElementById('setStyle').value;
            s.imageEndpoint = document.getElementById('setEndpoint').value.trim();
            window.Store.saveSettings(s);
        };
        ['setIntensity', 'setRequired', 'setPinyin', 'setAuto', 'setStyle', 'setEndpoint'].forEach(id => {
            document.getElementById(id).onchange = save;
        });
    },

    beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 660; g.gain.setValueAtTime(.2, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(.01, ctx.currentTime + .12);
            o.start(); o.stop(ctx.currentTime + .12);
        } catch (e) {}
    },

    toast(msg) {
        let t = document.querySelector('.toast');
        if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
        t.textContent = msg; t.classList.add('show');
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => t.classList.remove('show'), 2200);
    },
};

// 故事接龍：把「完成創作」改成分步推進的處理在 finish 中已涵蓋；
// 這裡為 relay 增加「下一段」按鈕的行為（透過 prompt 區提示），簡化為單篇分段書寫。
window.addEventListener('load', () => App.init());
