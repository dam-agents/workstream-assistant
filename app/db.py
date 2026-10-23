"""Workstream Assistant store: one SQLite file, shared by the API server, the scripts and the agent."""
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import config
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
  source       TEXT NOT NULL DEFAULT '',     -- the meeting source's id in config.json; ids are only unique within one source
  recording_id TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  relevant     INTEGER NOT NULL DEFAULT 0,   -- 1 if it changed a workstream
  seen_at      TEXT NOT NULL,
  PRIMARY KEY (source, recording_id)
);
CREATE TABLE IF NOT EXISTS debriefs (
  id            INTEGER PRIMARY KEY,
  source        TEXT NOT NULL DEFAULT '',      -- which meeting source it came from
  recording_id  TEXT NOT NULL,                 -- the meeting's id, as in seen_meetings
  title         TEXT NOT NULL,
  meeting_ts    TEXT,                          -- when the meeting happened
  url           TEXT,                          -- the recording / transcript
  why           TEXT NOT NULL DEFAULT '',      -- one line: what in it touches the owner's workstreams
  workstreams   TEXT NOT NULL DEFAULT '',      -- refs it seems to touch, e.g. "W1, W3"
  state         TEXT NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','started','done','dismissed')),
  proposed_at   TEXT NOT NULL,
  started_at    TEXT,
  closed_at     TEXT,
  outcome       TEXT NOT NULL DEFAULT '',      -- one line, written when the debrief is done
  UNIQUE (source, recording_id)
);
CREATE TABLE IF NOT EXISTS prebriefs (
  id            INTEGER PRIMARY KEY,
  workstream_id TEXT REFERENCES workstreams(id), -- the workstream whose folder it lives in; NULL = a call about none in particular
  also          TEXT NOT NULL DEFAULT '',        -- other refs the call touches, e.g. "W1, W3"
  title         TEXT NOT NULL,                   -- the call, e.g. "QA sync with Cleo"
  meeting_ts    TEXT,                            -- when the call is planned
  attendees     TEXT NOT NULL DEFAULT '',
  artifact_id   TEXT NOT NULL DEFAULT '',        -- the published prebrief; empty while it's still being written
  folder_id     TEXT NOT NULL DEFAULT '',        -- the artifact folder it is in now
  debrief_id    INTEGER REFERENCES debriefs(id), -- the debrief that used it
  state         TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','archived')),
  outcome       TEXT NOT NULL DEFAULT '',        -- one line, written when it's archived
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  archived_at   TEXT
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
    _migrate_to_sources(conn)
    _assign_refs(conn)
    return conn


def _cols(conn, table):
    return {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}


def _migrate_to_sources(conn):
    """Bring a database written before the input context became a list of sources up to date.

    Everything keyed per source — the sweep watermark, the watched channels, the processed meetings
    and the debriefs — used to be keyed per *kind* of source, assuming one Slack and one meeting
    source. Rows from then are attributed to the first source of the matching type, so an instance
    that had one of each keeps its history instead of re-reading everything.
    """
    chat = config.sources("chat")
    meet = config.sources("meetings")
    if "source" not in _cols(conn, "seen_meetings"):
        home = meet[0]["id"] if meet else "meetings"
        conn.executescript(f"""
            ALTER TABLE seen_meetings RENAME TO seen_meetings_old;
            CREATE TABLE seen_meetings (
              source TEXT NOT NULL DEFAULT '', recording_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
              relevant INTEGER NOT NULL DEFAULT 0, seen_at TEXT NOT NULL, PRIMARY KEY (source, recording_id));
            INSERT INTO seen_meetings (source, recording_id, title, relevant, seen_at)
              SELECT '{home}', recording_id, title, relevant, seen_at FROM seen_meetings_old;
            DROP TABLE seen_meetings_old;""")
        conn.commit()
    if "source" not in _cols(conn, "debriefs"):
        home = meet[0]["id"] if meet else "meetings"
        conn.execute("ALTER TABLE debriefs ADD COLUMN source TEXT NOT NULL DEFAULT ''")
        conn.execute("UPDATE debriefs SET source = ?", (home,))
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS debriefs_src_rec ON debriefs(source, recording_id)")
        conn.commit()
    old_chans = get_meta(conn, "slack_channels", "")
    if old_chans and not get_meta(conn, "channels", ""):
        set_meta(conn, "channels", json.dumps({chat[0]["id"] if chat else "slack": json.loads(old_chans)}))
    for group in (chat, meet):  # the watermark written when that type had exactly one source
        if not group:
            continue
        first, legacy = group[0], config.LEGACY_SWEEP_KEY[group[0]["type"]]
        if get_meta(conn, legacy, "") and not get_meta(conn, _sweep_key(first["id"]), ""):
            set_meta(conn, _sweep_key(first["id"]), get_meta(conn, legacy))
        # Any further source of that type is new: it has no watermark, so its first sweep reads ~7 days back.


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
    return {"me": ME, "github_repo": CFG["github_repo"], "generated_at": now(), "app_version": template_version(),
            "workstreams": tracked, "suggested": suggested, "followups": loose, "debriefs": open_debriefs(conn)}


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
    w["prebriefs"] = open_prebriefs(conn, ws_id)
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


TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.template.html")


def template_version():
    """Short hash of app.template.html. build.py stamps it into the page; the page sends it back with every request."""
    import hashlib
    with open(TEMPLATE, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def page_status(conn):
    """(ok, line) on whether the published page was built from the template on disk.
    A Kit Update can change the template without anything republishing the artifact, which leaves the page behind."""
    want = template_version()
    seen, seen_at = get_meta(conn, "page_version"), get_meta(conn, "page_seen_at")
    built = get_meta(conn, "built_version")
    if seen:
        if seen == want:
            return True, f"App page: up to date (last opened {seen_at})"
        return False, (f"App page: STALE. The page last opened ({seen_at}) was built from template {seen}, the template on disk is {want}. "
                       "Rebuild and republish it (app/README.md, Publishing).")
    if built and built != want:
        return False, f"App page: STALE. The last build was from template {built}, the template on disk is {want}. Rebuild and republish it."
    return True, "App page: not opened since this check was added; can't tell whether it's current"


def get_meta(conn, key, default=""):
    r = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return r["value"] if r else default


def set_meta(conn, key, value):
    conn.execute("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))
    conn.commit()


# ---- Per-source bookkeeping: one watermark, channel list and meeting history per configured source ----

def _sweep_key(source_id):
    return f"last_sweep_{source_id}"


def last_sweep(conn, source_id):
    """When this source was last swept successfully, or "" for a source that has never been swept."""
    return get_meta(conn, _sweep_key(source_id), "")


def mark_sweep(conn, source_id, when=None):
    """Move one source's watermark. Only at the end of a successful sweep of that source."""
    set_meta(conn, _sweep_key(source_id), when or now())
    return last_sweep(conn, source_id)


def _all_channels(conn):
    return json.loads(get_meta(conn, "channels", "{}"))


def channels(conn, source_id=None):
    """Channels read in full: one source's list, or {source_id: [...]} for every source."""
    all_ = _all_channels(conn)
    return all_.get(source_id, []) if source_id else all_


def channel_add(conn, source_id, channel_id, name):
    all_ = _all_channels(conn)
    all_[source_id] = [c for c in all_.get(source_id, []) if c["id"] != channel_id] + [{"id": channel_id, "name": name}]
    set_meta(conn, "channels", json.dumps(all_, ensure_ascii=False))
    return all_[source_id]


def channel_remove(conn, source_id, channel_id):
    all_ = _all_channels(conn)
    all_[source_id] = [c for c in all_.get(source_id, []) if c["id"] != channel_id]
    set_meta(conn, "channels", json.dumps(all_, ensure_ascii=False))
    return all_[source_id]


def mark_meeting_seen(conn, source_id, recording_id, title="", relevant=False):
    conn.execute("INSERT OR REPLACE INTO seen_meetings (source, recording_id, title, relevant, seen_at) VALUES (?,?,?,?,?)",
                 (source_id, str(recording_id), title, int(relevant), now()))
    conn.commit()


def seen_meeting_ids(conn, source_id):
    """The recording ids already processed in this source. Ids from other sources never collide with them."""
    return {r["recording_id"] for r in conn.execute("SELECT recording_id FROM seen_meetings WHERE source = ?", (source_id,))}


# ---- Debriefs: a meeting the sweep proposes and the owner chooses to talk through ----

def propose_debrief(conn, source_id, recording_id, title, meeting_ts=None, url=None, why="", workstreams=""):
    """Offer a meeting for debrief. It shows on the dashboard until the owner starts or dismisses it.
    Also marks the meeting as seen, so the sweep never proposes it twice. Returns the debrief id."""
    _need_link("debrief", title, url)
    conn.execute(
        """INSERT INTO debriefs (source, recording_id, title, meeting_ts, url, why, workstreams, proposed_at)
           VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(source, recording_id) DO NOTHING""",
        (source_id, str(recording_id), title, meeting_ts, url, why, workstreams, now()))
    conn.commit()
    mark_meeting_seen(conn, source_id, str(recording_id), title, True)
    return conn.execute("SELECT id FROM debriefs WHERE source = ? AND recording_id = ?",
                        (source_id, str(recording_id))).fetchone()["id"]


def _with_source_name(d):
    """Add the source's configured name, so the app and the chat can say which meeting tool it came from."""
    src = config.source(d["source"], "meetings") if d.get("source") else None
    d["source_name"] = src["name"] if src else (d.get("source") or "")
    return d


def open_debriefs(conn):
    """Proposed and started debriefs, newest meeting first: what the dashboard shows."""
    return [_with_source_name(d) for d in rows(conn.execute(
        "SELECT * FROM debriefs WHERE state IN ('proposed','started') ORDER BY COALESCE(meeting_ts, proposed_at) DESC"))]


def get_debrief(conn, debrief_id):
    r = conn.execute("SELECT * FROM debriefs WHERE id = ?", (int(debrief_id),)).fetchone()
    return _with_source_name(dict(r)) if r else None


def _set_debrief(conn, debrief_id, state, outcome=None):
    ts = now()
    sets, args = ["state = ?"], [state]
    if state == "started":
        sets.append("started_at = ?"); args.append(ts)
    if state in ("done", "dismissed"):
        sets.append("closed_at = ?"); args.append(ts)
    if outcome is not None:
        sets.append("outcome = ?"); args.append(outcome)
    cur = conn.execute(f"UPDATE debriefs SET {', '.join(sets)} WHERE id = ?", (*args, int(debrief_id)))
    conn.commit()
    return get_debrief(conn, debrief_id) if cur.rowcount else None


def start_debrief(conn, debrief_id):
    return _set_debrief(conn, debrief_id, "started")


def finish_debrief(conn, debrief_id, outcome=""):
    return _set_debrief(conn, debrief_id, "done", outcome)


def dismiss_debrief(conn, debrief_id, outcome=""):
    return _set_debrief(conn, debrief_id, "dismissed", outcome)


# ---- Prebriefs: the owner's preparation for a call, published as an artifact in the workstream's folder ----

PREBRIEF_DIR = os.path.join(os.path.dirname(DB_PATH), "prebriefs")
ARCHIVE = "archive"  # the folders key of the one archive folder


def prebrief_path(prebrief_id):
    """The working copy of a prebrief: the markdown that gets published. Instance data, never part of the kit."""
    return os.path.join(PREBRIEF_DIR, f"{int(prebrief_id)}.md")


def prebrief_folders(conn):
    """Artifact folder ids: workstream id (or "" for calls about none) -> folder id, plus ARCHIVE."""
    return json.loads(get_meta(conn, "prebrief_folders", "{}"))


def set_prebrief_folder(conn, key, folder_id):
    folders = prebrief_folders(conn)
    folders[key] = folder_id
    set_meta(conn, "prebrief_folders", json.dumps(folders))
    return folders


def prebrief_folder_name(conn, ws_id):
    """The name the artifact folder for this workstream's prebriefs gets when it's created."""
    if ws_id == ARCHIVE:
        return "Prebriefs · Archive"
    w = conn.execute("SELECT ref, name FROM workstreams WHERE id = ?", (ws_id,)).fetchone() if ws_id else None
    return f"Prebriefs · W{w['ref']} {w['name']}" if w else "Prebriefs · Other calls"


def add_prebrief(conn, ws_id, title, meeting_ts=None, attendees="", also=""):
    """Start a prebrief for a planned call. Returns its id; the markdown goes to prebrief_path(id)."""
    ws = resolve_workstream(conn, ws_id) if ws_id else None
    if ws_id and not ws:
        raise ValueError(f"no workstream {ws_id}")
    ts = now()
    cur = conn.execute(
        "INSERT INTO prebriefs (workstream_id, also, title, meeting_ts, attendees, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (ws, also, title, meeting_ts, attendees, ts, ts))
    conn.commit()
    os.makedirs(PREBRIEF_DIR, exist_ok=True)
    return cur.lastrowid


def _with_ref(conn, p):
    w = conn.execute("SELECT ref, name FROM workstreams WHERE id = ?", (p["workstream_id"],)).fetchone() if p["workstream_id"] else None
    p["ws_ref"] = f"W{w['ref']}" if w else ""
    p["ws_name"] = w["name"] if w else ""
    p["path"] = prebrief_path(p["id"])
    return p


def get_prebrief(conn, prebrief_id):
    r = conn.execute("SELECT * FROM prebriefs WHERE id = ?", (int(prebrief_id),)).fetchone()
    return _with_ref(conn, dict(r)) if r else None


def open_prebriefs(conn, ws_id=None):
    """Prebriefs not archived yet, soonest call first; those of one workstream when ws_id is given."""
    q, args = "SELECT * FROM prebriefs WHERE state = 'open'", ()
    if ws_id is not None:
        q, args = q + " AND workstream_id = ?", (resolve_workstream(conn, ws_id) or ws_id,)
    return [_with_ref(conn, p) for p in rows(conn.execute(q + " ORDER BY COALESCE(meeting_ts, created_at)", args))]


def update_prebrief(conn, prebrief_id, **fields):
    fields = {k: v for k, v in fields.items() if k in {"title", "meeting_ts", "attendees", "also", "artifact_id", "folder_id", "debrief_id"}}
    if fields:
        fields["updated_at"] = now()
        conn.execute(f"UPDATE prebriefs SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?", (*fields.values(), int(prebrief_id)))
        conn.commit()
    return get_prebrief(conn, prebrief_id)


def archive_prebrief(conn, prebrief_id, outcome="", debrief_id=None):
    """The call is over (debriefed, or it never happened). The artifact moves to the archive folder."""
    ts = now()
    conn.execute("UPDATE prebriefs SET state = 'archived', outcome = ?, debrief_id = COALESCE(?, debrief_id), "
                 "folder_id = ?, archived_at = ?, updated_at = ? WHERE id = ?",
                 (outcome, debrief_id, prebrief_folders(conn).get(ARCHIVE, ""), ts, ts, int(prebrief_id)))
    conn.commit()
    return get_prebrief(conn, prebrief_id)


def prebriefs_for_debrief(conn, debrief):
    """Open prebriefs that may be for this debrief's meeting: the one already linked, else those on a
    workstream the meeting seems to touch or planned within a day of it. A guess for the agent to confirm."""
    linked = [p for p in open_prebriefs(conn) if p["debrief_id"] == debrief["id"]]
    if linked:
        return linked
    refs = {r.strip().upper() for r in (debrief.get("workstreams") or "").split(",") if r.strip()}
    when = _parse(debrief.get("meeting_ts"))
    out = []
    for p in open_prebriefs(conn):
        if p["debrief_id"]:
            continue
        touches = {p["ws_ref"]} | {r.strip().upper() for r in p["also"].split(",") if r.strip()}
        pt = _parse(p["meeting_ts"])
        near = bool(when and pt and abs((when - pt).total_seconds()) <= 86400)
        if near or (refs & touches):
            out.append(p)
    return out


def _parse(ts):
    try:
        d = datetime.fromisoformat(ts) if ts else None
        return d if d is None or d.tzinfo else d.replace(tzinfo=TZ)
    except ValueError:
        return None
