import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.html':'text/html; charset=utf-8', '.json':'application/json; charset=utf-8', '.js':'text/javascript; charset=utf-8'}
    def log_message(self,*a): pass
http.server.ThreadingHTTPServer(('127.0.0.1',8811), functools.partial(H, directory='/home/claude/kira_ai/app/pub')).serve_forever()
