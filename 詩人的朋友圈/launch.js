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

const webServer = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0] || '/';
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath.slice(1));
  if (!filePath.startsWith(ROOT)) filePath = path.join(ROOT, 'index.html');
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
  console.log('  API：http://localhost:' + PORT_API);
  console.log('========================================');
  console.log('');

  const url = 'http://localhost:' + PORT_WEB + '/詩人的朋友圈/index.html';
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(open, [url], { stdio: 'ignore' }).unref();
});
