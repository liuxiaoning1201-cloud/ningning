#!/usr/bin/env python3
"""
詩人的朋友圈 - Python 版啟動腳本（含 API 代理）
當 Node 不可用時，可用此腳本提供網頁 + API 代理。
需在另一終端機執行：node server.js
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8080
API_PORT = 3001
API_BASE = f'http://127.0.0.1:{API_PORT}'

class ProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._proxy_request('GET')
        else:
            self._serve_static()

    def do_POST(self):
        if self.path.startswith('/api/'):
            self._proxy_request('POST')
        else:
            self.send_error(404)

    def _proxy_request(self, method):
        api_path = self.path.replace('/api', '')
        url = API_BASE + api_path
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else None
            req = urllib.request.Request(url, data=body, method=method)
            req.add_header('Content-Type', self.headers.get('Content-Type', 'application/json'))
            with urllib.request.urlopen(req, timeout=10) as resp:
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.end_headers()
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='ignore')
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            try:
                data = json.loads(body)
                self.wfile.write(json.dumps(data).encode())
            except:
                self.wfile.write(json.dumps({'error': body[:200]}).encode())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': '後端未啟動，請在另一終端機執行：node server.js'}).encode())

    def _serve_static(self):
        import os
        root = os.path.join(os.path.dirname(__file__), '..')
        path = self.path.split('?')[0] or '/'
        path = path.lstrip('/') or 'index.html'
        filepath = os.path.join(root, path)
        if not os.path.abspath(filepath).startswith(os.path.abspath(root)):
            self.send_error(403)
            return
        if not os.path.isfile(filepath):
            self.send_error(404)
            return
        ext = os.path.splitext(filepath)[1]
        mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'}
        with open(filepath, 'rb') as f:
            self.send_response(200)
            self.send_header('Content-Type', mime.get(ext, 'application/octet-stream'))
            self.end_headers()
            self.wfile.write(f.read())

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), ProxyHandler) as httpd:
        print('')
        print('=' * 40)
        print('  詩人的朋友圈 (Python 版)')
        print('=' * 40)
        print(f'  網頁：http://localhost:{PORT}/詩人的朋友圈/index.html')
        print(f'  API 代理：/api -> localhost:{API_PORT}')
        print('  請在另一終端機執行：node server.js')
        print('=' * 40)
        print('')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
