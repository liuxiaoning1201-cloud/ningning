// ==================== AI 老師（DeepSeek 代理） ====================
// 透過站點統一代理 /api/ai/deepseek 呼叫 DeepSeek，前端不持有任何金鑰。
// 兩個用途：
//   1. review(text)            — 給學生作文語序 / 邏輯 / 修改建議的回饋
//   2. toImagePrompts(...)      — 把每句話翻成英文繪本生圖提示詞（一次呼叫批量）

const AI_ENDPOINT = '/api/ai/deepseek';

const AITeacher = {
    available: true, // 若代理回 503 會被設為 false，之後走離線退路

    async _chat(messages, { json = false, max_tokens = 900, temperature = 0.5 } = {}) {
        const resp = await fetch(AI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app: 'lingganmofang',
                model: 'deepseek-chat',
                messages, max_tokens, temperature,
                ...(json ? { response_format: { type: 'json_object' } } : {}),
            }),
        });
        if (resp.status === 503) { this.available = false; throw new Error('llm_not_configured'); }
        if (!resp.ok) {
            const e = await resp.json().catch(() => ({}));
            throw new Error(e.message || ('AI 服務錯誤 ' + resp.status));
        }
        const data = await resp.json();
        return (data.choices && data.choices[0] && data.choices[0].message.content) || '';
    },

    // 給作文回饋。回傳 { overall, score(1-5), sentences:[{original, ok, issue, suggestion}], encouragement }
    async review(text) {
        const sys = `你是一位親切、有耐心的香港小學中文老師，正在批改一位小學生的看圖寫作。`
            + `請用繁體中文、淺白鼓勵的語氣評改。重點：`
            + `1) 逐句檢查語序與語法是否正確（例如主謂賓次序、量詞、連接詞、標點）；`
            + `2) 句子之間是否有邏輯、是否連貫通順；`
            + `3) 給出具體可照抄的「改寫示例」，而不是空泛建議；`
            + `4) 多給鼓勵，指出寫得好的地方。`
            + `只輸出 JSON，結構：{"overall":"整體一兩句評語","score":1到5的整數,`
            + `"sentences":[{"original":"原句","ok":true或false,"issue":"問題（沒問題寫空字串）","suggestion":"改寫後的句子（沒問題寫空字串）"}],`
            + `"encouragement":"一句溫暖的鼓勵"}。句子數量與學生原文一致，最多 8 句。`;
        const content = await this._chat(
            [{ role: 'system', content: sys }, { role: 'user', content: `學生作文：\n${text}` }],
            { json: true, max_tokens: 1200, temperature: 0.4 },
        );
        return this._parseJson(content);
    },

    // 把句子翻成英文繪本提示詞，一次呼叫得到陣列。失敗則回 null（由呼叫方走離線退路）
    async toImagePrompts(sentences, sceneTitle) {
        const sys = `You turn Chinese children's-story sentences into short English prompts for an illustration model. `
            + `For each sentence give ONE concise English phrase describing the visual scene (subject, place, action, mood). `
            + `Keep it concrete and child-friendly. No text in the image. `
            + `Output ONLY JSON: {"prompts":["...","..."]} with the same number and order as the input sentences.`;
        const user = `Scene theme: ${sceneTitle || 'a children story'}\nSentences:\n`
            + sentences.map((s, i) => `${i + 1}. ${s}`).join('\n');
        const content = await this._chat(
            [{ role: 'system', content: sys }, { role: 'user', content: user }],
            { json: true, max_tokens: 700, temperature: 0.6 },
        );
        const obj = this._parseJson(content);
        return obj && Array.isArray(obj.prompts) ? obj.prompts : null;
    },

    _parseJson(s) {
        if (!s) return null;
        try { return JSON.parse(s); } catch (e) {}
        const m = s.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
        return null;
    },
};

window.AITeacher = AITeacher;
