"""Sweep bookkeeping for the scheduled runs. Every input source is swept on its own watermark. Run from anywhere:
  python3 app/sweep.py sources                 every configured source, with its watermark and any problems
  python3 app/sweep.py state chat|meetings     print what the next sweep needs, for every source of that type; also the schedules' precheck
  python3 app/sweep.py state <source-id>       the same for one source only
  python3 app/sweep.py mark <source-id>        set that source's watermark to now (call per source, at the END of a successful sweep)
  python3 app/sweep.py mark chat|meetings      set the watermark of every source of that type
  python3 app/sweep.py seen <recording_id> [title] [relevant 0|1] [--source <id>]
                                               record a processed meeting (ids are per source)
  python3 app/sweep.py debrief-propose <recording_id> <title> [--source <id>] [--when ISO] [--url URL] [--why TEXT] [--ws "W1, W3"]
                                               offer a meeting for debrief on the dashboard (also marks it seen)
  python3 app/sweep.py debrief-show <id>       the meeting, why it was proposed, and where its transcript is
  python3 app/sweep.py debrief-start <id>      mark it started (the dashboard button does this; use it for a transcript uploaded in chat)
  python3 app/sweep.py debrief-done <id> [outcome]      the debrief is finished; one line on what changed
  python3 app/sweep.py debrief-dismiss <id> [reason]    the owner doesn't want it
  python3 app/sweep.py ensure-server           start the API server if it isn't answering
  python3 app/sweep.py channels [--source <id>]                 the channels read in full
  python3 app/sweep.py channel-add <id> <name> [--source <id>] / channel-remove <id> [--source <id>]

`--source` may be left out when only one source of that type is configured.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402
import db  # noqa: E402
from config import CFG  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = "/tmp/wsa-api.log"
FIRST_SWEEP_DAYS = 7  # a source that has never been swept is read this far back


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


def pick_source(name, type_=None):
    """The source named on the command line, or the only one of its type. Exits with an explanation if ambiguous."""
    if name:
        src = config.source(name, type_)
        if not src:
            sys.exit(f"no source “{name}” in config.json. Configured: {', '.join(config.ids(type_)) or 'none'}")
        return src
    src = config.only_source(type_) if type_ else None
    if not src:
        sys.exit(f"name the source with --source: {', '.join(config.ids(type_)) or 'none configured'}")
    return src


def since(conn, src):
    """(ISO watermark or "", how to describe where this source's sweep starts)."""
    last = db.last_sweep(conn, src["id"])
    if last:
        return last, f"{last} (unix {int(datetime.fromisoformat(last).timestamp())})"
    start = (datetime.now(db.TZ) - timedelta(days=FIRST_SWEEP_DAYS)).isoformat(timespec="seconds")
    return "", f"never swept — read about {FIRST_SWEEP_DAYS} days back, from {start} (unix {int(datetime.fromisoformat(start).timestamp())})"


def print_header(type_, srcs):
    print(f"Sweep: {type_} ({len(srcs)} source{'s' if len(srcs) != 1 else ''})")
    print(f"Owner: {db.ME or '(not configured: finish ONBOARDING.md)'}")
    print(f"API server: {'up' if server_up() else 'DOWN (start it: python3 app/sweep.py ensure-server)'}")
    print(db.page_status(db.connect())[1])
    print("Every source below is swept on its own watermark, and marked on its own: "
          "`python3 app/sweep.py mark <source-id>` per source, as each one is finished.")


def chat_state(conn, src):
    """What the chat sweep needs for one chat source. Returns True if there's anything to read."""
    _, desc = since(conn, src)
    print(f"\n--- [{src['id']}] {src['name']} — {src['kind']} ---")
    print(f"Read since: {desc}")
    if src["tools"]:
        print(f"Tools: the MCP server “{src['tools']}” (its tools are prefixed with it). Only this server's tools reach this source.")
    else:
        print("Tools: none named in config.json — tell the owner the sweep can't tell this source's tools apart.")
    print(f"The owner there: {src['account'] or '(not configured: the sweep can’t find their own messages or mentions)'}")
    if src["location"]:
        print(f"Workspace: {src['location']} (message permalinks are built from it)")
    if src["note"]:
        print(f"Note: {src['note']}")
    chans = db.channels(conn, src["id"])
    print(f"Channels to read in full ({len(chans)}): every new message, not only the owner's"
          if chans else "Channels to read in full: none (only the owner's messages and mentions of them)")
    for ch in chans:
        print(f"  - {ch['name']} ({ch['id']})")
    print(f"Items from this source use source “{src['name']} …”, so the owner can tell them apart.")
    return True


def meetings_state(conn, src):
    """What the meeting sweep needs for one meeting source. Returns True if there's anything to read."""
    _, desc = since(conn, src)
    seen = db.seen_meeting_ids(conn, src["id"])
    print(f"\n--- [{src['id']}] {src['name']} — {src['kind']} ---")
    print(f"Read since: {desc}")
    if src["kind"] == "upload":
        print("Nothing to sweep: transcripts arrive as chat uploads. Debrief one when the owner sends it.")
        return False
    if src["tools"]:
        print(f"Tools: the MCP server “{src['tools']}” (its tools are prefixed with it)")
    if src["location"]:
        print(f"Where: {src['location']}")
    if src["url_template"]:
        print(f"Link template: {src['url_template']} ({{id}} = the recording id)")
    if src["note"]:
        print(f"Note: {src['note']}")
    have = True
    if src["kind"] == "folder":
        if not os.path.isdir(src["location"]):
            print("Transcript folder NOT FOUND: tell the owner it may be unmounted; don't guess another path.")
            have = False
        else:
            new = sorted(set(transcript_files(src["location"])) - seen)
            print(f"New transcript files ({len(new)}):" if new else "No new transcript files in this source.")
            for f in new:
                print(f"  - {f}")
            have = bool(new)
    elif src["kind"] == "mcp":
        print("Search its tools for meetings after the watermark (see procedures/meeting-sweep.md).")
    elif src["kind"] == "github":
        print("List the commits that touched it since the watermark (see procedures/meeting-sweep.md).")
    print(f"Already processed here ({len(seen)}): {', '.join(sorted(seen)) or 'none'}")
    ods = [d for d in db.open_debriefs(conn) if d["source"] == src["id"]]
    if ods:
        print(f"Debriefs still open on the dashboard ({len(ods)}); don't propose these again:")
        for d in ods:
            print(f"  - #{d['id']} {d['state']}: {d['title']} ({d['recording_id']})")
    print(f"Record what you process with --source {src['id']}: "
          f"`sweep.py seen <recording_id> \"<title>\" 0 --source {src['id']}` / `sweep.py debrief-propose … --source {src['id']}`.")
    return have


TYPE_WORDS = {"chat": "chat", "slack": "chat", "meetings": "meetings", "meeting": "meetings"}


def state(conn, which):
    """Precheck + briefing. `which` is a type ("chat", "meetings") or one source's id."""
    type_ = TYPE_WORDS.get(which)  # "slack" still works: schedules made before sources were a list
    if type_:
        srcs = config.sources(type_)
    else:
        one = config.source(which)
        if not one:
            sys.exit(f"“{which}” is neither a type (chat, meetings) nor a configured source. "
                     f"Configured: {', '.join(config.ids()) or 'none'}")
        srcs, type_ = [one], one["type"]
    if not db.ME or not srcs:
        print(f"No {which} source configured in config.json; skipping." if db.ME
              else "Onboarding isn't finished (no owner in config.json); skipping.")
        sys.exit(1)  # as a precheck: skip this run without waking the agent
    print_header(type_, srcs)
    probs = config.problems()
    if probs:
        print("\nProblems with the configuration (tell the owner, don't work around them):")
        for p in probs:
            print(f"  - {p}")
    have = [(src, (chat_state if type_ == "chat" else meetings_state)(conn, src)) for src in srcs]
    rej = db.rejected(conn)
    if rej:
        print("\nRejected workstreams (never re-suggest): " + "; ".join(
            f"W{r['ref']} {r['name']} ({r['reject_reason'] or 'no reason'})" for r in rej))
    if type_ == "chat":
        import checks
        print("\nOpen asks and follow-ups with their done check (DONE = the service shows it's finished):")
        for k, it, ok, d in checks.evaluate(conn):
            mark = {True: "DONE", False: "open", None: "judge"}[ok]
            print(f"  {mark:5} {checks.label(k, it)}  ->  {d}")
    todo = [s["id"] for s, ok in have if ok]
    if not todo:
        print(f"\nNothing new in any {type_} source; skipping.")
        sys.exit(1)
    print(f"\nSources to sweep in this run: {', '.join(todo)}")


def main():
    conn = db.connect()
    argv = sys.argv[1:]
    cmd = argv[0] if argv else "state"
    ap = argparse.ArgumentParser(prog=f"sweep.py {cmd}", add_help=False)
    ap.add_argument("--source")

    if cmd == "sources":
        print(f"Owner: {db.ME or '(not configured)'} · timezone {CFG['timezone']} · default repo {CFG['github_repo'] or '(none)'}")
        for type_ in ("chat", "meetings"):
            srcs = config.sources(type_)
            print(f"\n{type_} sources ({len(srcs)}):" if srcs else f"\n{type_} sources: none configured")
            for s in srcs:
                last = db.last_sweep(conn, s["id"])
                extra = f", {len(db.channels(conn, s['id']))} channels" if type_ == "chat" else \
                        f", {len(db.seen_meeting_ids(conn, s['id']))} meetings processed"
                print(f"  [{s['id']}] {s['name']} — {s['kind']}"
                      + (f", tools “{s['tools']}”" if s["tools"] else "")
                      + (f", at {s['location']}" if s["location"] else "")
                      + f"\n      last sweep: {last or 'never'}{extra}")
        probs = config.problems()
        if probs:
            print("\nProblems:")
            for p in probs:
                print(f"  - {p}")
    elif cmd == "state":
        state(conn, argv[1] if len(argv) > 1 else "chat")
    elif cmd == "mark":
        which = argv[1] if len(argv) > 1 else ""
        srcs = config.sources(TYPE_WORDS[which]) if which in TYPE_WORDS else [pick_source(which)]
        if not srcs:
            sys.exit(f"no source matches “{which}”. Configured: {', '.join(config.ids()) or 'none'}")
        for s in srcs:
            print(f"marked [{s['id']}] {s['name']} at {db.mark_sweep(conn, s['id'])}")
    elif cmd == "seen":
        a, rest = ap.parse_known_args(argv[1:])
        src = pick_source(a.source, "meetings")
        db.mark_meeting_seen(conn, src["id"], rest[0], rest[1] if len(rest) > 1 else "",
                             len(rest) > 2 and rest[2] == "1")
        print(f"ok, in [{src['id']}]")
    elif cmd == "debrief-propose":
        ap.add_argument("recording_id"); ap.add_argument("title")
        ap.add_argument("--when"); ap.add_argument("--url"); ap.add_argument("--why", default=""); ap.add_argument("--ws", default="")
        a = ap.parse_args(argv[1:])
        src = pick_source(a.source, "meetings")
        did = db.propose_debrief(conn, src["id"], a.recording_id, a.title, a.when, a.url, a.why, a.ws)
        print(f"debrief #{did} proposed from [{src['id']}] {src['name']}")
    elif cmd == "debrief-show":
        d = db.get_debrief(conn, argv[1])
        if not d:
            sys.exit(f"no debrief {argv[1]}")
        src = config.source(d["source"], "meetings")
        print(f"Debrief #{d['id']} ({d['state']}): {d['title']}")
        print(f"Meeting time: {d['meeting_ts'] or 'unknown'}")
        print(f"Source: {d['source_name'] or '(unknown)'} [{d['source']}]" + (f" — {src['kind']}" if src else " — no longer in config.json"))
        print(f"Recording: {d['url'] or '(no link)'}")
        print(f"Why it was proposed: {d['why'] or '(no reason given)'}")
        print(f"Workstreams it seems to touch: {d['workstreams'] or '(not said)'}")
        print(f"Recording id: {d['recording_id']}")
        kind = src["kind"] if src else ""
        loc = src["location"] if src else ""
        tools = src["tools"] if src else ""
        where = {"mcp": f"fetch it by that id from the MCP server “{tools or loc}” (its tools are prefixed with that name)",
                 "folder": f"read the file {os.path.join(loc, d['recording_id'])}",
                 "github": f"fetch {d['recording_id']} from {loc} with gh",
                 "upload": "the owner uploaded it in chat: read the file they sent"}.get(
                     kind, "that source isn't in config.json any more: ask the owner where the transcript is")
        print(f"Transcript: {where}")
        if src and src["note"]:
            print(f"Note on this source: {src['note']}")
        pbs = db.prebriefs_for_debrief(conn, d)
        if pbs:
            linked = any(p["debrief_id"] == d["id"] for p in pbs)
            print("Prebrief for this meeting:" if linked else
                  "Prebriefs that may be for this meeting (confirm with the owner, then `prebrief.py link <id> " + str(d["id"]) + "`):")
            for p in pbs:
                print(f"  - #{p['id']} {p['ws_ref'] or '-'} {p['title']} ({p['meeting_ts'] or 'no time'}): read {p['path']}")
        else:
            print("Prebrief: none open for this meeting")
    elif cmd in ("debrief-start", "debrief-done", "debrief-dismiss"):
        fn = {"debrief-start": db.start_debrief, "debrief-done": db.finish_debrief, "debrief-dismiss": db.dismiss_debrief}[cmd]
        d = fn(conn, argv[1]) if cmd == "debrief-start" else fn(conn, argv[1], " ".join(argv[2:]))
        print(f"debrief #{d['id']} {d['state']}" if d else f"no debrief {argv[1]}")
    elif cmd == "ensure-server":
        if not server_up():
            subprocess.Popen(["python3", os.path.join(HERE, "server.py")], cwd=HERE,
                             stdout=open(LOG, "a"), stderr=subprocess.STDOUT, start_new_session=True)
            time.sleep(1.5)
        print("server up" if server_up() else f"server failed to start, see {LOG}")
        ok, line = db.page_status(conn)
        if not ok:
            print(line)
    elif cmd in ("channels", "channel-add", "channel-remove"):
        a, rest = ap.parse_known_args(argv[1:])
        if cmd == "channels" and not a.source and not rest:
            for sid, chans in (db.channels(conn) or {}).items():
                src = config.source(sid, "chat")
                print(f"[{sid}] {src['name'] if src else 'not in config.json any more'}:")
                for c in chans:
                    print(f"  {c['name']} ({c['id']})")
            if not db.channels(conn):
                print("no channels watched in any source")
            return
        src = pick_source(a.source or (rest.pop(0) if cmd == "channels" and rest else None), "chat")
        chans = db.channel_add(conn, src["id"], rest[0], rest[1]) if cmd == "channel-add" else \
            db.channel_remove(conn, src["id"], rest[0]) if cmd == "channel-remove" else db.channels(conn, src["id"])
        print(f"[{src['id']}] {src['name']}:")
        for c in chans:
            print(f"  {c['name']} ({c['id']})")
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
