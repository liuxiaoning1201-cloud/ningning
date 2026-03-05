/**
 * LLM API 後端代理
 * 用於轉發聊天請求，避免在前端暴露 API Key
 *
 * 使用方式：
 * 1. 將 API 金鑰填入 .env 檔案（已設定 DeepSeek）
 * 2. 執行：node server.js
 * 3. 前端設定 API 網址為 http://localhost:3001
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// 載入 .env（若存在）
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key) process.env[key] = val;
    }
  });
}

const PORT = process.env.PORT || 3001;

// DeepSeek 或 OpenAI 相容 API
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
            error: '請在 .env 檔案中設定 OPENAI_API_KEY，或使用環境變數'
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
            model: process.env.OPENAI_MODEL || 'deepseek-chat',
            messages: apiMessages,
            max_tokens: 1024,
            temperature: 0.7
          })
        });

        const data = await response.json();
        if (data.error) {
          const errMsg = data.error?.message || data.error?.code || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
          console.error('DeepSeek API 錯誤:', errMsg);
          res.writeHead(response.status >= 400 ? response.status : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errMsg }));
          return;
        }

        const reply = data.choices?.[0]?.message?.content || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        console.error('伺服器錯誤:', err);
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
    console.warn('警告：未設定 API 金鑰，請檢查 .env 檔案中的 OPENAI_API_KEY');
  } else {
    console.log('已載入 DeepSeek API 設定');
  }
});
