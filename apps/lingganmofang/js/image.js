// ==================== 文字生圖 ====================
// 預設呼叫站點同源端點 /api/image（Cloudflare Workers AI · FLUX.1 schnell），
// 把每一句話變成一張兒童繪本插圖（可選寫實 / 動畫 / 水彩風格）。
// 失敗或未配置時，退回離線 canvas 繪本插圖，確保功能永遠可用。

const ImageGen = {
    // 後端生圖端點：預設同源；設定中可覆寫為自訂 Worker
    endpoint() {
        const s = window.Store.loadSettings();
        return (s.imageEndpoint && s.imageEndpoint.trim()) || '/api/image';
    },
    style() {
        const s = window.Store.loadSettings();
        return s.imageStyle || 'storybook';
    },

    // 由六要素拼出繪本風格 prompt（離線退路 / 無 AI 翻譯時用）
    buildPrompt(slots, scene) {
        const who = (slots.who && slots.who.word) || 'a little child';
        const where = (slots.where && slots.where.word) || (scene ? scene.title : 'a place');
        const event = (slots.event && slots.event.word) || 'a wonderful experience';
        const emotion = (slots.emotion && slots.emotion.word) || 'happy';
        return `a ${who} at ${where}, ${event}, feeling ${emotion}`;
    },

    // 呼叫後端生圖；成功回 dataURL，失敗回 null
    async callApi(prompt, seed) {
        try {
            const resp = await fetch(this.endpoint(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, seed, style: this.style() }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.imageUrl || data.dataUrl || null;
        } catch (e) { return null; }
    },

    // 單張：給整篇/單頁用（相容舊呼叫）
    async generate(slots, scene, text) {
        const prompt = this.buildPrompt(slots, scene);
        const seed = Math.floor(Math.random() * 1e6);
        const url = await this.callApi(prompt, seed);
        if (url) return { imageUrl: url, prompt, seed, source: 'api' };
        return { imageUrl: this.canvasIllustration(slots, scene, seed), prompt, seed, source: 'offline' };
    },

    // 把一段文字切成句子
    splitSentences(text) {
        return text
            .replace(/\n+/g, '')
            .split(/(?<=[。！？!?…])/)
            .map(s => s.trim())
            .filter(s => s.length >= 2)
            .slice(0, 8);
    },

    // 逐句生圖：回傳 [{ text, imageUrl, prompt }]
    // onProgress(done, total) 供 UI 顯示進度
    async generatePages(text, slots, scene, onProgress) {
        const sentences = this.splitSentences(text);
        if (!sentences.length) sentences.push(text.trim());
        const total = sentences.length;

        // 嘗試用 AI 把每句翻成英文提示詞（一次呼叫）
        let enPrompts = null;
        try {
            if (window.AITeacher && window.AITeacher.available) {
                enPrompts = await window.AITeacher.toImagePrompts(sentences, scene ? scene.title : '');
            }
        } catch (e) { enPrompts = null; }

        const base = this.buildPrompt(slots, scene);
        const pages = [];
        for (let i = 0; i < sentences.length; i++) {
            if (onProgress) onProgress(i, total);
            const seed = Math.floor(Math.random() * 1e6);
            const prompt = (enPrompts && enPrompts[i]) ? enPrompts[i] : `${base}, ${sentences[i]}`;
            const url = await this.callApi(prompt, seed);
            pages.push({
                text: sentences[i],
                imageUrl: url || this.canvasIllustration(slots, scene, seed),
                imagePrompt: prompt,
                source: url ? 'api' : 'offline',
            });
        }
        if (onProgress) onProgress(total, total);
        return pages;
    },

    // 離線繪本插圖：漸層天空 + 場景 emoji 拼貼（API 不可用時的安全退路）
    canvasIllustration(slots, scene, seed) {
        const canvas = document.createElement('canvas');
        canvas.width = 768; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const grad = scene ? scene.gradient : ['#a8e6cf', '#dcedc1'];

        const g = ctx.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0, grad[0]); g.addColorStop(1, grad[1]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, 768, 512);

        const rg = ctx.createRadialGradient(620, 110, 10, 620, 110, 120);
        rg.addColorStop(0, 'rgba(255,255,255,0.9)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(620, 110, 120, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(384, 470, 420, 90, 0, 0, Math.PI * 2);
        ctx.fill();

        const emojis = (scene ? scene.emojis : ['🌳', '🌸', '☀️']).slice();
        const elementEmoji = { who: '🧒', where: '🏞️', when: '🕐', event: '⚡', emotion: '😊', descriptor: '✨' };
        Object.values(slots || {}).forEach(s => { if (s) emojis.push(elementEmoji[s.element] || '✨'); });

        let rnd = seed;
        const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
        emojis.forEach((emo) => {
            const x = 90 + rand() * 580;
            const y = 200 + rand() * 220;
            const size = 56 + rand() * 56;
            ctx.font = `${size}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(emo, x, y);
        });

        ctx.font = '150px serif';
        ctx.textAlign = 'center';
        ctx.fillText(elementEmoji.who, 250, 360);

        return canvas.toDataURL('image/png');
    },
};

window.ImageGen = ImageGen;
