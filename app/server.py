"""API for the Workstream Assistant app. Listens on 127.0.0.1:<port> (5555 by default, the only port interactive artifacts reach)."""
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import db
from config import CFG

ROUTES = []


def route(method, pattern):
    def deco(fn):
        ROUTES.append((method, re.compile(f"^{pattern}$"), fn))
        return fn
    return deco


@route("GET", r"/api/health")
def health(conn, body):
    return 200, {"ok": True, "time": db.now()}


@route("GET", r"/api/summary")
def get_summary(conn, body):
    return 200, db.summary(conn)


@route("GET", r"/api/workstreams/(?P<ws_id>[\w-]+)")
def get_workstream(conn, body, ws_id):
    w = db.workstream(conn, ws_id)
    return (200, w) if w else (404, {"error": "no such workstream"})


@route("PATCH", r"/api/workstreams/(?P<ws_id>[\w-]+)")
def patch_workstream(conn, body, ws_id):
    db.update_workstream(conn, ws_id, body)
    return 200, db.workstream(conn, ws_id)


@route("POST", r"/api/workstreams/(?P<ws_id>[\w-]+)/approve")
def approve_workstream(conn, body, ws_id):
    w = db.decide(conn, ws_id, True)
    return (200, w) if w else (404, {"error": "no such workstream"})


@route("POST", r"/api/workstreams/(?P<ws_id>[\w-]+)/reject")
def reject_workstream(conn, body, ws_id):
    w = db.decide(conn, ws_id, False, (body.get("reason") or "").strip())
    return (200, w) if w else (404, {"error": "no such workstream"})


@route("POST", r"/api/workstreams/(?P<ws_id>[\w-]+)/asks")
def post_ask(conn, body, ws_id):
    if not body.get("text"):
        return 400, {"error": "text is required"}
    return 201, {"id": db.add_ask(conn, ws_id, body["text"], body.get("asked_by", ""), body.get("source", ""), body.get("url"))}


@route("POST", r"/api/asks/(?P<ask_id>\d+)/done")
def done_ask(conn, body, ask_id):
    a = db.resolve_ask(conn, int(ask_id))
    return (200, a) if a else (404, {"error": "no such ask"})


@route("POST", r"/api/followups")
def post_followup(conn, body):
    if not body.get("text"):
        return 400, {"error": "text is required"}
    return 201, {"id": db.add_followup(conn, body["text"], body.get("workstream_id"), body.get("waiting_on", ""),
                                       body.get("next_step", ""), body.get("source", ""), body.get("url"))}


@route("POST", r"/api/followups/(?P<followup_id>\d+)/done")
def done_followup(conn, body, followup_id):
    f = db.resolve_followup(conn, int(followup_id))
    return (200, f) if f else (404, {"error": "no such follow-up"})


@route("GET", r"/api/rejected")
def get_rejected(conn, body):
    return 200, db.rejected(conn)


@route("POST", r"/api/workstreams/(?P<ws_id>[\w-]+)/items")
def post_item(conn, body, ws_id):
    if not body.get("title"):
        return 400, {"error": "title is required"}
    return 201, {"id": db.add_item(conn, ws_id, body)}


@route("PATCH", r"/api/items/(?P<item_id>\d+)")
def patch_item(conn, body, item_id):
    item = db.update_item(conn, int(item_id), body)
    return (200, item) if item else (404, {"error": "no such item"})


@route("POST", r"/api/workstreams/(?P<ws_id>[\w-]+)/progress")
def post_progress(conn, body, ws_id):
    if not body.get("summary"):
        return 400, {"error": "summary is required"}
    entry_id = db.add_progress(conn, ws_id, body["summary"], body.get("ts"), body.get("type", "message"),
                               body.get("outcome", "info"), body.get("url"))
    return 201, {"id": entry_id}


class Handler(BaseHTTPRequestHandler):
    def _handle(self, method):
        path = urlparse(self.path).path
        length = int(self.headers.get("content-length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        except json.JSONDecodeError:
            return self._send(400, {"error": "body is not JSON"})
        for m, pattern, fn in ROUTES:
            match = pattern.match(path)
            if m == method and match:
                conn = db.connect()
                try:
                    status, payload = fn(conn, body, **match.groupdict())
                except Exception as e:  # report inside the page, not only in the log
                    status, payload = 500, {"error": f"{type(e).__name__}: {e}"}
                finally:
                    conn.close()
                return self._send(status, payload)
        self._send(404, {"error": f"no route for {method} {path}"})

    def _send(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PATCH(self):
        self._handle("PATCH")

    def do_PUT(self):
        self._handle("PUT")

    def do_DELETE(self):
        self._handle("DELETE")


if __name__ == "__main__":
    db.connect().close()
    ThreadingHTTPServer(("127.0.0.1", CFG["port"]), Handler).serve_forever()
