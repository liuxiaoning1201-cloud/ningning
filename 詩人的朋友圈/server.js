/**
 * LLM API 後端代理
 * 用於轉發聊天請求，避免在前端暴露 API Key
 *
 * 使用方式：
 * 1. Node.js 18+ 內建 fetch，無需額外依賴
 * 2. 設定環境變數：OPENAI_API_KEY=sk-xxx
 * 3. 啟動：node server.js
 * 4. 前端設定 API 網址為 http://localhost:3001
 */
const http = require('http');

const PORT = process.env.PORT || 3001;

// 支援 OpenAI 相容格式的 API
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hasKey: !!OPENAI_API_KEY }));
    return;
  }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { system, messages } = JSON.parse(body || '{}');
        if (!system || !Array.isArray(messages) || messages.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '缺少 system 或 messages' }));
          return;
        }

        if (!OPENAI_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: '請設定環境變數 OPENAI_API_KEY。例如：OPENAI_API_KEY=sk-xxx node server.js'
          }));
          return;
        }

        const apiMessages = [
          { role: 'system', content: system },
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        ];

        const response = await fetch(API_BASE + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OPENAI_API_KEY
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: apiMessages,
            max_tokens: 1024,
            temperature: 0.7
          })
        });

        const data = await response.json();
        if (data.error) {
          res.writeHead(response.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }));
          return;
        }

        const reply = data.choices?.[0]?.message?.content || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || '伺服器錯誤' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`詩人的朋友圈 API 代理已啟動：http://localhost:${PORT}`);
  if (!OPENAI_API_KEY) {
    console.warn('警告：未設定 OPENAI_API_KEY，聊天功能將無法使用');
  }
});
