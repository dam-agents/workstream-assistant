"""Add workstream suggestions (state='suggested') from a JSON file, with their first progress, asks, follow-ups and deadlines.

  python3 app/suggest.py suggestions.json

Skips any id that already exists, whether approved or rejected, so a rejected suggestion is never re-proposed.
The file is a list of objects shaped like EXAMPLE below. Write it to /tmp, not into the repo.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db  # noqa: E402

EXAMPLE = [
    {
        "id": "release-w43",
        "name": "This week's deployment (v0.4.0)",
        "owner": "Ada",
        "roles": "Ben: release notes · Cleo: environments",
        "status": "amber",
        "goal": "v0.4.0 is on prod by Friday with release notes. Done when the prod tag exists and the notes are published.",
        "status_note": "Cut is on staging; release notes are missing.",
        "tldr": "The cut went to staging on Tuesday. Two fixes still need to land before prod, and nobody has written the notes yet.",
        "key_points": "Blocker: #1234 crashes the importer on staging.\nNext: cut rc2 once #1234 and PR #1240 merge.\nDone when: prod tag v0.4.0 and published notes.",
        "progress": [
            {"ts": "2026-10-20T09:01:00+02:00", "type": "release", "outcome": "done", "summary": "v0.4.0-rc1 deployed to staging",
             "url": "https://github.com/acme/app/releases/tag/v0.4.0-rc1"},
        ],
        "asks": [
            {"text": "Write the v0.4.0 release notes", "asked_by": "Ben", "source": "Slack #release",
             "url": "https://acme.slack.com/archives/C01/p1792393278815279",
             "check_spec": {"type": "gh_release", "prefix": "v0.4.0"}},
        ],
        "followups": [
            {"text": "Asked Cleo to rebase rc2 onto the hotfix", "waiting_on": "Cleo", "next_step": "rc2 tag includes the hotfix",
             "source": "Slack DM", "url": "https://acme.slack.com/archives/D01/p1792403368448759",
             "check_spec": {"type": "gh_tag", "prefix": "v0.4.0-rc2", "contains": "v0.3.9"}},
        ],
        "deadlines": [
            {"text": "v0.4.0 on prod", "due": "2026-10-23", "firm": True, "source": "Slack #release",
             "url": "https://acme.slack.com/archives/C01/p1792393100000000",
             "check_spec": {"type": "gh_tag", "prefix": "v0.4.0", "contains": "v0.4.0-rc1"}},
        ],
    },
]


def add(conn, s):
    if conn.execute("SELECT 1 FROM workstreams WHERE id = ?", (s["id"],)).fetchone():
        print(f"skip {s['id']}: already exists")
        return
    db.add_workstream(conn, s["id"], s["name"], s.get("goal", ""), s.get("owner", ""), s.get("roles", ""),
                      s.get("status", "amber"), s.get("status_note", ""), s.get("tldr", ""), s.get("key_points", ""),
                      "suggested", s.get("epic_label"), s.get("epic_url"))
    for p in s.get("progress", []):
        db.add_progress(conn, s["id"], p["summary"], p.get("ts"), p.get("type", "message"), p.get("outcome", "info"), p.get("url"))
    for a in s.get("asks", []):
        db.add_ask(conn, s["id"], a["text"], a.get("asked_by", ""), a.get("source", ""), a.get("url"), a.get("ts"),
                   json.dumps(a["check_spec"]) if a.get("check_spec") else "", a.get("done_when", ""))
    for f in s.get("followups", []):
        db.add_followup(conn, f["text"], s["id"], f.get("waiting_on", ""), f.get("next_step", ""), f.get("source", ""),
                        f.get("url"), f.get("ts"), json.dumps(f["check_spec"]) if f.get("check_spec") else "", f.get("done_when", ""))
    for d in s.get("deadlines", []):
        db.add_deadline(conn, s["id"], d["text"], d["due"], d.get("firm", False), d.get("source", ""), d.get("url"),
                        json.dumps(d["check_spec"]) if d.get("check_spec") else "", d.get("done_when", ""))
    ref = conn.execute("SELECT ref FROM workstreams WHERE id = ?", (s["id"],)).fetchone()["ref"]
    print(f"suggested W{ref} {s['name']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    with open(sys.argv[1], encoding="utf-8") as f:
        items = json.load(f)
    conn = db.connect()
    for s in items:
        add(conn, s)
