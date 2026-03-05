/**
 * 一鍵啟動：同時啟動 API 後端 + 靜態網頁伺服器，並開啟瀏覽器
 * 執行：node launch.js
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT_WEB = 8080;
const PORT_API = 3001;

// 靜態檔案伺服器
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const API_TARGET = 'http://127.0.0.1:' + PORT_API;

const webServer = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0] || '/';

  // 代理 /api/* 到後端，解決跨域與 file:// 連線問題
  if (urlPath.startsWith('/api/')) {
    const apiPath = urlPath.replace('/api', '');
    const targetUrl = new URL(API_TARGET + apiPath);
    const opts = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname,
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json' }
    };
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        opts.headers['Content-Length'] = Buffer.byteLength(body);
        const proxyReq = http.request(opts, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' });
          proxyRes.pipe(res);
        });
        proxyReq.on('error', () => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '後端未啟動，請確認 node server.js 已執行' }));
        });
        proxyReq.write(body);
        proxyReq.end();
      });
    } else {
      const proxyReq = http.request(opts, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '後端未啟動，請確認 node server.js 已執行' }));
      });
      proxyReq.end();
    }
    return;
  }

  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath.slice(1));
  const ext = path.extname(filePath);
  const contentType = mime[ext] || 'application/octet-stream';

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(ROOT))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// 啟動 API 後端
const api = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});
api.on('error', (err) => {
  console.error('API 後端啟動失敗:', err.message);
});
process.on('SIGINT', () => {
  api.kill();
  process.exit();
});

// 啟動網頁伺服器
webServer.listen(PORT_WEB, () => {
  console.log('');
  console.log('========================================');
  console.log('  詩人的朋友圈 已啟動');
  console.log('========================================');
  console.log('  網頁：http://localhost:' + PORT_WEB + '/詩人的朋友圈/index.html');
  console.log('  API 已代理至 /api，聊天功能自動連線');
  console.log('========================================');
  console.log('');

  const url = 'http://localhost:' + PORT_WEB + '/詩人的朋友圈/index.html';
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  setTimeout(() => spawn(open, [url], { stdio: 'ignore' }).unref(), 1500);
});
