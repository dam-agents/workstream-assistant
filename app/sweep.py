"""Sweep bookkeeping for the scheduled runs. Run from anywhere:
  python3 app/sweep.py state slack|meetings   print what the next sweep needs; also the schedules' precheck
  python3 app/sweep.py mark slack|meetings    set the watermark to now (call at the END of a successful sweep)
  python3 app/sweep.py seen <recording_id> [title] [relevant 0|1]   recording_id: the source's id, or the file path
  python3 app/sweep.py debrief-propose <recording_id> <title> [--when ISO] [--url URL] [--why TEXT] [--ws "W1, W3"]
                                              offer a meeting for debrief on the dashboard (also marks it seen)
  python3 app/sweep.py debrief-show <id>      the meeting, why it was proposed, and where its transcript is
  python3 app/sweep.py debrief-start <id>     mark it started (the dashboard button does this; use it for a transcript uploaded in chat)
  python3 app/sweep.py debrief-done <id> [outcome]      the debrief is finished; one line on what changed
  python3 app/sweep.py debrief-dismiss <id> [reason]    the owner doesn't want it
  python3 app/sweep.py ensure-server          start the API server if it isn't answering
  python3 app/sweep.py channels               list the watched Slack channels
  python3 app/sweep.py channel-add <id> <name> / channel-remove <id>
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db  # noqa: E402
from config import CFG  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = "/tmp/wsa-api.log"


def server_up():
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{CFG['port']}/api/health", timeout=3)
        return True
    except Exception:
        return False


def transcript_files(root):
    """Paths under a transcript folder, relative to it; these are the folder's recording ids."""
    out = []
    for d, _, files in os.walk(root):
        out += [os.path.relpath(os.path.join(d, f), root) for f in files if not f.startswith(".")]
    return out


def main():
    conn = db.connect()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "state"
    if cmd == "state":
        src = sys.argv[2]
        mt = CFG["meetings"]
        if not db.ME or (src == "slack" and not CFG["slack"]["user_id"]) or (src == "meetings" and mt["kind"] in ("", "upload")):
            print(f"{src} sweep not configured in config.json; skipping.")
            sys.exit(1)  # as a precheck: skip this run without waking the agent
        last = db.get_meta(conn, f"last_sweep_{src}", "")
        print(f"Source: {src}")
        print(f"Owner: {db.ME or '(not configured: finish ONBOARDING.md)'}")
        print(f"Last successful sweep: {last or 'never'}")
        if last:
            print(f"Unix time of last sweep: {int(datetime.fromisoformat(last).timestamp())}")
        print(f"API server: {'up' if server_up() else 'DOWN (start it: python3 app/sweep.py ensure-server)'}")
        if src == "slack":
            chans = json.loads(db.get_meta(conn, "slack_channels", "[]"))
            print(f"Slack user: {CFG['slack']['user_id'] or '(not configured)'}")
            print("Channels to read in full (every message since the last sweep, not only the owner's):")
            for ch in chans:
                print(f"  - {ch['name']} ({ch['id']})")
            import checks
            print("\nOpen asks and follow-ups with their done check (DONE = the service shows it's finished):")
            for k, it, ok, d in checks.evaluate(conn):
                mark = {True: "DONE", False: "open", None: "judge"}[ok]
                print(f"  {mark:5} {checks.label(k, it)}  ->  {d}")
        if src == "meetings":
            seen = db.seen_meeting_ids(conn)
            print(f"Transcripts: {mt['kind']} at {mt['location']}")
            if mt["kind"] == "folder" and not os.path.isdir(mt["location"]):
                print("Transcript folder NOT FOUND: tell the owner it may be unmounted; don't guess another path.")
            elif mt["kind"] == "folder":
                new = sorted(set(transcript_files(mt["location"])) - seen)
                if not new:
                    print("No new transcript files; skipping.")
                    sys.exit(1)
                print(f"New transcript files ({len(new)}):")
                for f in new:
                    print(f"  - {f}")
            print(f"Already processed meetings ({len(seen)}): {', '.join(sorted(seen))}")
            ods = db.open_debriefs(conn)
            if ods:
                print(f"Debriefs still open on the dashboard ({len(ods)}); don't propose these again:")
                for d in ods:
                    print(f"  - #{d['id']} {d['state']}: {d['title']} ({d['recording_id']})")
        rej = db.rejected(conn)
        if rej:
            print("Rejected workstreams (never re-suggest): " + "; ".join(
                f"W{r['ref']} {r['name']} ({r['reject_reason'] or 'no reason'})" for r in rej))
    elif cmd == "mark":
        db.set_meta(conn, f"last_sweep_{sys.argv[2]}", db.now())
        print(f"marked {sys.argv[2]} at {db.get_meta(conn, f'last_sweep_{sys.argv[2]}')}")
    elif cmd == "seen":
        db.mark_meeting_seen(conn, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "",
                             len(sys.argv) > 4 and sys.argv[4] == "1")
        print("ok")
    elif cmd == "debrief-propose":
        import argparse
        ap = argparse.ArgumentParser(prog="sweep.py debrief-propose")
        ap.add_argument("recording_id"); ap.add_argument("title")
        ap.add_argument("--when"); ap.add_argument("--url"); ap.add_argument("--why", default=""); ap.add_argument("--ws", default="")
        a = ap.parse_args(sys.argv[2:])
        print(f"debrief #{db.propose_debrief(conn, a.recording_id, a.title, a.when, a.url, a.why, a.ws)} proposed")
    elif cmd == "debrief-show":
        d = db.get_debrief(conn, sys.argv[2])
        if not d:
            sys.exit(f"no debrief {sys.argv[2]}")
        mt = CFG["meetings"]
        print(f"Debrief #{d['id']} ({d['state']}): {d['title']}")
        print(f"Meeting time: {d['meeting_ts'] or 'unknown'}")
        print(f"Recording: {d['url'] or '(no link)'}")
        print(f"Why it was proposed: {d['why'] or '(no reason given)'}")
        print(f"Workstreams it seems to touch: {d['workstreams'] or '(not said)'}")
        print(f"Recording id: {d['recording_id']}")
        where = {"mcp": f"fetch it from the MCP server “{mt['location']}” by that id",
                 "folder": f"read the file {os.path.join(mt['location'], d['recording_id'])}",
                 "github": f"fetch {d['recording_id']} from {mt['location']} with gh",
                 "upload": "the owner uploaded it in chat: read the file they sent"}.get(mt["kind"], "no transcript source configured: ask the owner what happened")
        print(f"Transcript: {where}")
    elif cmd in ("debrief-start", "debrief-done", "debrief-dismiss"):
        fn = {"debrief-start": db.start_debrief, "debrief-done": db.finish_debrief, "debrief-dismiss": db.dismiss_debrief}[cmd]
        d = fn(conn, sys.argv[2]) if cmd == "debrief-start" else fn(conn, sys.argv[2], " ".join(sys.argv[3:]))
        print(f"debrief #{d['id']} {d['state']}" if d else f"no debrief {sys.argv[2]}")
    elif cmd == "ensure-server":
        if not server_up():
            subprocess.Popen(["python3", os.path.join(HERE, "server.py")], cwd=HERE,
                             stdout=open(LOG, "a"), stderr=subprocess.STDOUT, start_new_session=True)
            time.sleep(1.5)
        print("server up" if server_up() else f"server failed to start, see {LOG}")
    elif cmd in ("channels", "channel-add", "channel-remove"):
        chans = json.loads(db.get_meta(conn, "slack_channels", "[]"))
        if cmd == "channel-add":
            chans = [c for c in chans if c["id"] != sys.argv[2]] + [{"id": sys.argv[2], "name": sys.argv[3]}]
        elif cmd == "channel-remove":
            chans = [c for c in chans if c["id"] != sys.argv[2]]
        db.set_meta(conn, "slack_channels", json.dumps(chans, ensure_ascii=False))
        for c in chans:
            print(f"{c['name']} ({c['id']})")
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
