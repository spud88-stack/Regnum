#!/usr/bin/env python3
"""Local server for Regnum. Run: python3 serve.py  then open http://localhost:8765"""
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'Regnum running at http://localhost:{PORT}')
    httpd.serve_forever()
