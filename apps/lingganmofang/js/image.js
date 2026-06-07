// ==================== 文字生圖 ====================
// 由六要素組 prompt（穩定、貼題、安全），呼叫後端代理（Cloudflare Worker）生圖。
// 若未設定代理端點，退回離線的 canvas 繪本插圖，確保功能可用。

const ImageGen = {
    // 由六要素拼出繪本風格 prompt
    buildPrompt(slots, scene) {
        const who = (slots.who && slots.who.word) || '一個小朋友';
        const where = (slots.where && slots.where.word) || (scene ? scene.title : '一個地方');
        const event = (slots.event && slots.event.word) || '一段奇妙的經歷';
        const emotion = (slots.emotion && slots.emotion.word) || '快樂';
        return `children's storybook illustration, soft watercolor, warm colors, ` +
            `a ${who} in ${where}, ${event}, feeling ${emotion}, cute, gentle, no text, safe for kids`;
    },

    // 主入口：回傳 { imageUrl, prompt, seed, source }
    async generate(slots, scene, text) {
        const settings = window.Store.loadSettings();
        const prompt = this.buildPrompt(slots, scene);
        const seed = Math.floor(Math.random() * 100000);

        if (settings.imageEndpoint) {
            try {
                const resp = await fetch(settings.imageEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, seed }),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const url = data.imageUrl || data.dataUrl;
                    if (url) return { imageUrl: url, prompt, seed, source: 'api' };
                }
            } catch (e) { /* 退回離線繪本 */ }
        }
        return { imageUrl: this.canvasIllustration(slots, scene, seed), prompt, seed, source: 'offline' };
    },

    // 離線繪本插圖：漸層天空 + 場景 emoji 拼貼 + 要素點綴
    canvasIllustration(slots, scene, seed) {
        const canvas = document.createElement('canvas');
        canvas.width = 768; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const grad = scene ? scene.gradient : ['#a8e6cf', '#dcedc1'];

        const g = ctx.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0, grad[0]); g.addColorStop(1, grad[1]);
        ctx.fillStyle = g; ctx.fillRect(0, 0, 768, 512);

        // 柔光太陽/月亮
        const rg = ctx.createRadialGradient(620, 110, 10, 620, 110, 120);
        rg.addColorStop(0, 'rgba(255,255,255,0.9)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(620, 110, 120, 0, Math.PI * 2); ctx.fill();

        // 地面
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(384, 470, 420, 90, 0, 0, Math.PI * 2);
        ctx.fill();

        // 場景 emoji 散佈（偽隨機，依 seed 穩定）
        const emojis = (scene ? scene.emojis : ['🌳', '🌸', '☀️']).slice();
        // 加入要素 emoji
        const elementEmoji = { who: '🧒', where: '🏞️', when: '🕐', event: '⚡', emotion: '😊', descriptor: '✨' };
        Object.values(slots).forEach(s => { if (s) emojis.push(elementEmoji[s.element] || '✨'); });

        let rnd = seed;
        const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
        emojis.forEach((emo, i) => {
            const x = 90 + rand() * 580;
            const y = 200 + rand() * 220;
            const size = 56 + rand() * 56;
            ctx.font = `${size}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(emo, x, y);
        });

        // 主角放大置中偏左
        const heroEmoji = elementEmoji.who;
        ctx.font = '150px serif';
        ctx.textAlign = 'center';
        ctx.fillText(heroEmoji, 250, 360);

        return canvas.toDataURL('image/png');
    },
};

window.ImageGen = ImageGen;
