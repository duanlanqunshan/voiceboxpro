"""
SRT 字幕转语音 - 前端启动脚本

使用方式：
    python start_srt_ui.py

然后在浏览器打开 http://localhost:8080

说明：
- 这个脚本会启动一个 HTTP 服务器，提供前端页面
- API 请求会自动代理到后端 (默认 http://127.0.0.1:17493)
- 需要先用 python -m backend.main 启动后端
"""

import http.server
import socketserver
import urllib.request
import os
import sys

PORT = 8080
API_BASE = "http://127.0.0.1:17493"

HTML_FILE = os.path.join(os.path.dirname(__file__), "srt-upload.html")

def _proxy_request(handler, method):
    """Forward request to backend API."""
    path = handler.path
    
    # Read body
    content_length = int(handler.headers.get('Content-Length', 0))
    body = handler.rfile.read(content_length) if content_length > 0 else None
    
    # Build backend URL
    url = f"{API_BASE}{path}"
    
    # Copy headers (excluding hop headers)
    hop_headers = {'host', 'content-length', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'}
    headers = {k: v for k, v in handler.headers.items() if k.lower() not in hop_headers}
    
    req = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method,
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            handler.send_response(resp.status)
            handler.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
            handler.send_header("Access-Control-Allow-Origin", "*")
            handler.end_headers()
            handler.wfile.write(resp.read())
    except urllib.error.HTTPError as e:
        handler.send_response(e.code)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.end_headers()
        handler.wfile.write(e.read())
    except Exception as e:
        handler.send_response(500)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.end_headers()
        handler.wfile.write(f'{{"detail": "Proxy error: {str(e)}"}}'.encode())


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            with open(HTML_FILE, "rb") as f:
                self.wfile.write(f.read())
        else:
            # Serve other static files
            return super().do_GET()

    def do_POST(self):
        _proxy_request(self, 'POST')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def log_message(self, format, *args):
        # Suppress normal request logging
        pass


def main():
    if not os.path.exists(HTML_FILE):
        print(f"错误：找不到 {HTML_FILE}")
        print("请确保 srt-upload.html 和此脚本在同一目录")
        return 1

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"SRT 前端界面启动成功！")
        print(f"请打开浏览器访问: http://localhost:{PORT}")
        print(f"API 代理到: {API_BASE}")
        print("按 Ctrl+C 停止")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止")
            return 0


if __name__ == "__main__":
    sys.exit(main())
