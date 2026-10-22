"""Render app.html from the template with a snapshot of the current database embedded (for when the server is down)."""
import json
import os

import db

HERE = os.path.dirname(os.path.abspath(__file__))

conn = db.connect()
summary = db.summary(conn)
snapshot = {"summary": summary,
            "workstreams": {w["id"]: db.workstream(conn, w["id"]) for w in summary["workstreams"] + summary["suggested"]}}
data = json.dumps(snapshot, ensure_ascii=False).replace("</", "<\\/")
with open(os.path.join(HERE, "app.template.html"), encoding="utf-8") as f:
    html = f.read().replace("__SNAPSHOT__", data).replace("__VERSION__", db.template_version())
with open(os.path.join(HERE, "app.html"), "w", encoding="utf-8") as f:
    f.write(html)
db.set_meta(conn, "built_version", db.template_version())
print(f"app.html: {len(html)} bytes, {len(summary['workstreams'])} workstreams")
