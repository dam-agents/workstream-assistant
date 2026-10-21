"""Workstream Assistant store: one SQLite file, shared by the API server, the scripts and the agent."""
import os
import re
import sqlite3
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from config import CFG, ROOT

DB_PATH = os.environ.get("WSA_DB", os.path.join(ROOT, "data", "wsa.db"))
ME = CFG["owner"]
STALE_DAYS = 3
TZ = ZoneInfo(CFG["timezone"])

SCHEMA = """
CREATE TABLE IF NOT EXISTS workstreams (
  id            TEXT PRIMARY KEY,
  ref           INTEGER UNIQUE,                -- short permanent handle, shown as W<ref>; never reused
  name          TEXT NOT NULL,
  goal          TEXT NOT NULL DEFAULT '',
  owner         TEXT NOT NULL DEFAULT '',
  roles         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'amber' CHECK (status IN ('red','amber','green')),
  status_note   TEXT NOT NULL DEFAULT '',
  tldr          TEXT NOT NULL DEFAULT '',
  key_points    TEXT NOT NULL DEFAULT '',      -- one point per line, "Label: text"
  epic_label    TEXT,
  epic_url      TEXT,
  state         TEXT NOT NULL DEFAULT 'suggested' CHECK (state IN ('suggested','approved','rejected')),
  reject_reason TEXT NOT NULL DEFAULT '',
  decided_at    TEXT NOT NULL DEFAULT '',
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY,
  workstream_id TEXT NOT NULL REFERENCES workstreams(id),
  kind          TEXT NOT NULL DEFAULT 'action' CHECK (kind IN ('action','open')),
  owner         TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  ticket_label  TEXT,
  ticket_url    TEXT,
  status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done','unknown')),
  source        TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  closed_at     TEXT
);
CREATE TABLE IF NOT EXISTS progress (
  id            INTEGER PRIMARY KEY,
  workstream_id TEXT NOT NULL REFERENCES workstreams(id),
  ts            TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'message',
  outcome       TEXT NOT NULL DEFAULT 'info' CHECK (outcome IN ('pass','fail','blocked','done','risk','info')),
  summary       TEXT NOT NULL,
  url           TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id            INTEGER PRIMARY KEY,
  workstream_id TEXT NOT NULL REFERENCES workstreams(id),
  kind          TEXT NOT NULL CHECK (kind IN ('decision','principle','later')),
  text          TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS links (
  id            INTEGER PRIMARY KEY,
  workstream_id TEXT NOT NULL REFERENCES workstreams(id),
  label         TEXT NOT NULL,
  url           TEXT NOT NULL,
  group_name    TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS snapshots (
  workstream_id TEXT NOT NULL REFERENCES workstreams(id),
  day           TEXT NOT NULL,
  open          INTEGER NOT NULL,
  done          INTEGER NOT NULL,
  blocked       INTEGER NOT NULL,
  untracked     INTEGER NOT NULL,
  PRIMARY KEY (workstream_id, day)
);
CREATE TABLE IF NOT EXISTS asks (
  id            INTEGER PRIMARY KEY,
  workstream_id TEXT NOT NULL REFERENCES workstreams(id),
  text          TEXT NOT NULL,
  asked_by      TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT '',
  url           TEXT,
  ts            TEXT NOT NULL,
  check_spec    TEXT NOT NULL DEFAULT '',      -- machine done check (JSON, see checks.py)
  done_when     TEXT NOT NULL DEFAULT '',      -- done check in words, judged by the sweeps
  done_at       TEXT
);
CREATE TABLE IF NOT EXISTS followups (
  id            INTEGER PRIMARY KEY,
  workstream_id TEXT REFERENCES workstreams(id),   -- NULL = loose, not part of any workstream
  text          TEXT NOT NULL,
  waiting_on    TEXT NOT NULL DEFAULT '',          -- who has the next move; ME means it needs the owner
  next_step     TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT '',
  url           TEXT,
  ts            TEXT NOT NULL,
  check_spec    TEXT NOT NULL DEFAULT '',
  done_when     TEXT NOT NULL DEFAULT '',
  done_at       TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS seen_meetings (
  recording_id TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '',
  relevant     INTEGER NOT NULL DEFAULT 0,   -- 1 if it changed a workstream
  seen_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_ws ON items(workstream_id);
CREATE INDEX IF NOT EXISTS asks_ws ON asks(workstream_id);
CREATE INDEX IF NOT EXISTS progress_ws_ts ON progress(workstream_id, ts);
"""

ITEM_FIELDS = {"kind", "owner", "title", "detail", "ticket_label", "ticket_url", "status", "source"}
WORKSTREAM_FIELDS = {"tldr", "key_points", "name", "goal", "owner", "roles", "status", "status_note", "epic_label", "epic_url", "archived"}


def now():
    return datetime.now(TZ).isoformat(timespec="seconds")


def connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA)
    _assign_refs(conn)
    return conn


def _assign_refs(conn):
    """Give every workstream without a ref the next number, oldest first. Runs on every connect, so new ones get one too."""
    todo = conn.execute("SELECT id FROM workstreams WHERE ref IS NULL ORDER BY created_at, rowid").fetchall()
    if not todo:
        return
    n = conn.execute("SELECT COALESCE(MAX(ref), 0) FROM workstreams").fetchone()[0]
    for r in todo:
        n += 1
        conn.execute("UPDATE workstreams SET ref = ? WHERE id = ?", (n, r["id"]))
    conn.commit()


def resolve_workstream(conn, key):
    """Workstream id from a ref ('W3', 'w3', '3') or an id ('qa'). None if unknown."""
    m = re.fullmatch(r"[Ww]?(\d+)", str(key).strip())
    if m:
        r = conn.execute("SELECT id FROM workstreams WHERE ref = ?", (int(m.group(1)),)).fetchone()
        return r["id"] if r else None
    r = conn.execute("SELECT id FROM workstreams WHERE id = ?", (key,)).fetchone()
    return r["id"] if r else None


def rows(cur):
    return [dict(r) for r in cur.fetchall()]


def add_workstream(conn, ws_id, name, goal="", owner="", roles="", status="amber", status_note="",
                   tldr="", key_points="", state="suggested", epic_label=None, epic_url=None):
    """New workstream. The agent adds candidates as 'suggested'; the owner approves or rejects them in the app."""
    ts = now()
    conn.execute(
        """INSERT INTO workstreams (id, name, goal, owner, roles, status, status_note, tldr, key_points, state,
                                   epic_label, epic_url, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ws_id, name, goal, owner, roles, status, status_note, tldr, key_points, state, epic_label, epic_url, ts, ts))
    conn.commit()
    _assign_refs(conn)
    return ws_id


def _counts(conn, ws_id):
    r = conn.execute(
        """SELECT
             SUM(status != 'done')                                        AS open,
             SUM(status = 'done')                                         AS done,
             SUM(status = 'blocked')                                      AS blocked,
             SUM(kind = 'action' AND status != 'done' AND ticket_url IS NULL) AS untracked,
             SUM(status != 'done' AND owner = ?)                          AS mine
           FROM items WHERE workstream_id = ?""",
        (ME, ws_id),
    ).fetchone()
    return {k: (r[k] or 0) for k in ("open", "done", "blocked", "untracked", "mine")}


def snapshot(conn):
    day = datetime.now(TZ).date().isoformat()
    for w in conn.execute("SELECT id FROM workstreams WHERE archived = 0 AND state = 'approved'").fetchall():
        c = _counts(conn, w["id"])
        conn.execute(
            "INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?,?,?)",
            (w["id"], day, c["open"], c["done"], c["blocked"], c["untracked"]),
        )
    conn.commit()


def summary(conn):
    snapshot(conn)
    tracked = rows(conn.execute("SELECT * FROM workstreams WHERE archived = 0 AND state = 'approved' ORDER BY name"))
    suggested = rows(conn.execute(
        "SELECT id, ref, name, owner, goal, tldr, status, created_at FROM workstreams WHERE state = 'suggested' ORDER BY created_at"))
    stale_before = (datetime.now(TZ) - timedelta(days=STALE_DAYS)).isoformat()
    open_asks = {r["workstream_id"]: r["n"] for r in conn.execute(
        "SELECT workstream_id, COUNT(*) AS n FROM asks WHERE done_at IS NULL GROUP BY workstream_id")}
    my_followups = {r["workstream_id"]: r["n"] for r in conn.execute(
        """SELECT workstream_id, COUNT(*) AS n FROM followups
           WHERE done_at IS NULL AND waiting_on = ? AND workstream_id IS NOT NULL GROUP BY workstream_id""", (ME,))}
    open_followups = {r["workstream_id"]: r["n"] for r in conn.execute(
        "SELECT workstream_id, COUNT(*) AS n FROM followups WHERE done_at IS NULL AND workstream_id IS NOT NULL GROUP BY workstream_id")}
    for w in tracked + suggested:
        w["asks_open"] = open_asks.get(w["id"], 0) + my_followups.get(w["id"], 0)  # everything that needs the owner
        w["followups_open"] = open_followups.get(w["id"], 0)
    for w in tracked:
        w["counts"] = _counts(conn, w["id"])
        last = conn.execute("SELECT MAX(ts) AS ts FROM progress WHERE workstream_id = ?", (w["id"],)).fetchone()["ts"]
        w["last_activity"] = last
        w["stale"] = last is None or last < stale_before
    loose = rows(conn.execute(
        "SELECT * FROM followups WHERE workstream_id IS NULL AND done_at IS NULL ORDER BY (waiting_on = ?) DESC, ts", (ME,)))
    return {"me": ME, "github_repo": CFG["github_repo"], "generated_at": now(),
            "workstreams": tracked, "suggested": suggested, "followups": loose}


def workstream(conn, ws_id):
    ws_id = resolve_workstream(conn, ws_id) or ws_id
    w = conn.execute("SELECT * FROM workstreams WHERE id = ?", (ws_id,)).fetchone()
    if not w:
        return None
    w = dict(w)
    w["counts"] = _counts(conn, ws_id)
    w["items"] = rows(conn.execute(
        "SELECT * FROM items WHERE workstream_id = ? ORDER BY kind, (owner = ?) DESC, owner, id", (ws_id, ME)))
    w["progress"] = rows(conn.execute("SELECT * FROM progress WHERE workstream_id = ? ORDER BY ts", (ws_id,)))
    w["notes"] = rows(conn.execute("SELECT * FROM notes WHERE workstream_id = ? ORDER BY kind, id", (ws_id,)))
    w["links"] = rows(conn.execute("SELECT * FROM links WHERE workstream_id = ? ORDER BY group_name, id", (ws_id,)))
    w["asks"] = rows(conn.execute("SELECT * FROM asks WHERE workstream_id = ? AND done_at IS NULL ORDER BY ts", (ws_id,)))
    w["followups"] = rows(conn.execute(
        "SELECT * FROM followups WHERE workstream_id = ? AND done_at IS NULL ORDER BY (waiting_on = ?) DESC, ts", (ws_id, ME)))
    return w


def update_item(conn, item_id, fields):
    fields = {k: v for k, v in fields.items() if k in ITEM_FIELDS}
    old = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if not old:
        return None
    if not fields:
        return dict(old)
    ts = now()
    fields["updated_at"] = ts
    if "status" in fields:
        fields["closed_at"] = ts if fields["status"] == "done" else None
    conn.execute(f"UPDATE items SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?", (*fields.values(), item_id))
    if "status" in fields and fields["status"] != old["status"]:
        conn.execute(
            "INSERT INTO progress (workstream_id, ts, type, outcome, summary) VALUES (?,?,?,?,?)",
            (old["workstream_id"], ts, "update", "done" if fields["status"] == "done" else "info",
             f"“{old['title']}” ({old['owner'] or 'no owner'}): {old['status']} → {fields['status']}"),
        )
    conn.commit()
    return dict(conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone())


def add_item(conn, ws_id, fields):
    fields = {k: v for k, v in fields.items() if k in ITEM_FIELDS}
    ts = now()
    cur = conn.execute(
        """INSERT INTO items (workstream_id, kind, owner, title, detail, ticket_label, ticket_url, status, source, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (ws_id, fields.get("kind", "action"), fields.get("owner", ""), fields["title"], fields.get("detail", ""),
         fields.get("ticket_label"), fields.get("ticket_url"), fields.get("status", "todo"),
         fields.get("source", ""), ts, ts),
    )
    conn.commit()
    return cur.lastrowid


def add_progress(conn, ws_id, summary_text, ts=None, type_="message", outcome="info", url=None):
    """One piece of evidence on the workstream's timeline: a PR, ticket change, message, meeting, release, doc."""
    if type_ != "update":
        _need_link("progress", summary_text, url)
    cur = conn.execute(
        "INSERT INTO progress (workstream_id, ts, type, outcome, summary, url) VALUES (?,?,?,?,?,?)",
        (ws_id, ts or now(), type_, outcome, summary_text, url),
    )
    conn.commit()
    return cur.lastrowid


def update_workstream(conn, ws_id, fields):
    fields = {k: v for k, v in fields.items() if k in WORKSTREAM_FIELDS}
    if not fields:
        return
    ws_id = resolve_workstream(conn, ws_id) or ws_id
    fields["updated_at"] = now()
    conn.execute(f"UPDATE workstreams SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?", (*fields.values(), ws_id))
    conn.commit()


def decide(conn, ws_id, approve, reason=""):
    ws_id = resolve_workstream(conn, ws_id) or ws_id
    w = conn.execute("SELECT state FROM workstreams WHERE id = ?", (ws_id,)).fetchone()
    if not w:
        return None
    conn.execute("UPDATE workstreams SET state = ?, reject_reason = ?, decided_at = ?, updated_at = ? WHERE id = ?",
                 ("approved" if approve else "rejected", "" if approve else reason, now(), now(), ws_id))
    conn.commit()
    return workstream(conn, ws_id)


def rejected(conn):
    """What the owner turned down. Check this before suggesting a new workstream."""
    return rows(conn.execute("SELECT id, ref, name, goal, reject_reason, decided_at FROM workstreams WHERE state = 'rejected'"))


def _need_link(kind, text, url):
    """Every ask, follow-up and progress entry must link to exactly what it refers to."""
    if not url:
        print(f"WARNING: {kind} without a link: {text[:80]!r}. Add the Slack permalink / GitHub / meeting URL.", file=sys.stderr)


def add_ask(conn, ws_id, text, asked_by="", source="", url=None, ts=None, check_spec="", done_when=""):
    """Something the owner must do: a request to them, an action assigned to them, or something they promised.
    Give it a done check (see checks.py) whenever a service can show it's done."""
    _need_link("ask", text, url)
    cur = conn.execute(
        "INSERT INTO asks (workstream_id, text, asked_by, source, url, ts, check_spec, done_when) VALUES (?,?,?,?,?,?,?,?)",
        (ws_id, text, asked_by, source, url, ts or now(), check_spec, done_when))
    conn.commit()
    return cur.lastrowid


def resolve_ask(conn, ask_id):
    a = conn.execute("SELECT * FROM asks WHERE id = ?", (ask_id,)).fetchone()
    if not a:
        return None
    ts = now()
    conn.execute("UPDATE asks SET done_at = ? WHERE id = ?", (ts, ask_id))
    conn.execute("INSERT INTO progress (workstream_id, ts, type, outcome, summary) VALUES (?,?,?,?,?)",
                 (a["workstream_id"], ts, "update", "done", f"Done: {a['text']}"))
    conn.commit()
    return dict(conn.execute("SELECT * FROM asks WHERE id = ?", (ask_id,)).fetchone())


def add_followup(conn, text, ws_id=None, waiting_on="", next_step="", source="", url=None, ts=None, check_spec="", done_when=""):
    """A quick open loop the owner started or is part of, usually outside any workstream. Tie it to one when it belongs there."""
    _need_link("follow-up", text, url)
    cur = conn.execute(
        """INSERT INTO followups (workstream_id, text, waiting_on, next_step, source, url, ts, check_spec, done_when)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (ws_id, text, waiting_on, next_step, source, url, ts or now(), check_spec, done_when))
    conn.commit()
    return cur.lastrowid


def resolve_followup(conn, followup_id):
    f = conn.execute("SELECT * FROM followups WHERE id = ?", (followup_id,)).fetchone()
    if not f:
        return None
    ts = now()
    conn.execute("UPDATE followups SET done_at = ? WHERE id = ?", (ts, followup_id))
    if f["workstream_id"]:
        conn.execute("INSERT INTO progress (workstream_id, ts, type, outcome, summary) VALUES (?,?,?,?,?)",
                     (f["workstream_id"], ts, "update", "done", f"Done: {f['text']}"))
    conn.commit()
    return dict(conn.execute("SELECT * FROM followups WHERE id = ?", (followup_id,)).fetchone())


def get_meta(conn, key, default=""):
    r = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return r["value"] if r else default


def set_meta(conn, key, value):
    conn.execute("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))
    conn.commit()


def mark_meeting_seen(conn, recording_id, title="", relevant=False):
    conn.execute("INSERT OR REPLACE INTO seen_meetings (recording_id, title, relevant, seen_at) VALUES (?,?,?,?)",
                 (recording_id, title, int(relevant), now()))
    conn.commit()


def seen_meeting_ids(conn):
    return {r["recording_id"] for r in conn.execute("SELECT recording_id FROM seen_meetings")}
