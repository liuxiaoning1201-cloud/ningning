const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const API_KEY = 'sk-59c6824d87fd4b348f94d957fcd84d70';
const API_URL = 'https://api.deepseek.com/chat/completions';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const isStream = req.body.stream === true;

    const apiRes = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    if (!apiRes.ok) {
      const err = await apiRes.text();
      return res.status(apiRes.status).json({ error: err });
    }

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = apiRes.body.getReader();
      const decoder = new TextDecoder();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(decoder.decode(value, { stream: true }));
        }
      };
      pump().catch(() => res.end());
    } else {
      const data = await apiRes.json();
      res.json(data);
    }
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🏯 詩友記 PoetPal 已啟動！`);
  console.log(`📖 請打開瀏覽器訪問: http://localhost:${PORT}\n`);
});
