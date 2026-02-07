#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            print('=== LOG ===')
            print(json.dumps(data, indent=2, ensure_ascii=False))
            sys.stdout.flush()
        except:
            print(body.decode())
            sys.stdout.flush()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')
    
    def log_message(self, format, *args):
        pass

print('Log server on :9999')
sys.stdout.flush()
HTTPServer(('0.0.0.0', 9999), Handler).serve_forever()
