"""Prebrief bookkeeping: the owner's preparation for a call, kept per workstream. Run from anywhere:
  python3 app/prebrief.py new <W3|-> <title> [--when ISO] [--with "Cleo, Ben"] [--also "W1"]
                                             start one; prints its id and the markdown file to write
  python3 app/prebrief.py list [W3]          open prebriefs (of one workstream), soonest call first
  python3 app/prebrief.py show <id>          everything about one, and where it is published
  python3 app/prebrief.py folder <W3|-|archive>
                                             the artifact folder it belongs in: its id, or the name to create it with
  python3 app/prebrief.py folder-set <W3|-|archive> <folder_id>
                                             remember a folder created with create_artifact_folder
  python3 app/prebrief.py published <id> <artifact_id> <folder_id>
                                             record the artifact once it is published (create_artifact)
  python3 app/prebrief.py link <id> <debrief_id>
                                             the debrief this prebrief prepared
  python3 app/prebrief.py archive <id> [outcome]
                                             the call is over; then move the artifact to the archive folder (update_artifact)

`-` is a call that belongs to no workstream. The procedure is the prebrief skill, .claude/skills/prebrief/SKILL.md.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db  # noqa: E402


def folder_key(conn, which):
    """Workstream id, "" for no workstream, or db.ARCHIVE."""
    if which.lower() == db.ARCHIVE:
        return db.ARCHIVE
    if which in ("-", ""):
        return ""
    ws = db.resolve_workstream(conn, which)
    if not ws:
        sys.exit(f"no workstream {which}")
    return ws


def print_prebrief(p):
    print(f"Prebrief #{p['id']} ({p['state']}): {p['title']}")
    print(f"Workstream: {p['ws_ref'] + ' ' + p['ws_name'] if p['ws_ref'] else '(none)'}" + (f"; also {p['also']}" if p["also"] else ""))
    print(f"Call: {p['meeting_ts'] or 'time not set'}" + (f" with {p['attendees']}" if p["attendees"] else ""))
    print(f"Markdown: {p['path']}" + ("" if os.path.exists(p["path"]) else " (not written yet)"))
    print(f"Artifact: {p['artifact_id'] + ' (platform://artifacts/' + p['artifact_id'] + ')' if p['artifact_id'] else 'not published yet'}")
    print(f"Folder: {p['folder_id'] or '(none)'}")
    if p["debrief_id"]:
        print(f"Debrief: #{p['debrief_id']}")
    if p["outcome"]:
        print(f"Outcome: {p['outcome']}")


def main():
    conn = db.connect()
    argv = sys.argv[1:]
    cmd = argv[0] if argv else "list"
    if cmd == "new":
        ap = argparse.ArgumentParser(prog="prebrief.py new")
        ap.add_argument("workstream"); ap.add_argument("title")
        ap.add_argument("--when"); ap.add_argument("--with", dest="attendees", default=""); ap.add_argument("--also", default="")
        a = ap.parse_args(argv[1:])
        try:
            pid = db.add_prebrief(conn, None if a.workstream == "-" else a.workstream, a.title, a.when, a.attendees, a.also)
        except ValueError as e:
            sys.exit(str(e))
        print(f"prebrief #{pid}; write it to {db.prebrief_path(pid)}")
    elif cmd == "list":
        ps = db.open_prebriefs(conn, argv[1] if len(argv) > 1 else None)
        for p in ps:
            print(f"#{p['id']} {p['ws_ref'] or '-':4} {p['meeting_ts'] or 'no time':25} {p['title']}"
                  + ("" if p["artifact_id"] else "  (not published)"))
        if not ps:
            print("no open prebriefs")
    elif cmd == "show":
        p = db.get_prebrief(conn, argv[1])
        print_prebrief(p) if p else sys.exit(f"no prebrief {argv[1]}")
    elif cmd == "folder":
        key = folder_key(conn, argv[1])
        fid = db.prebrief_folders(conn).get(key)
        print(f"folder {fid}" if fid else
              f"no folder yet: create_artifact_folder name “{db.prebrief_folder_name(conn, key)}”, "
              f"then `prebrief.py folder-set {argv[1]} <folder_id>`")
    elif cmd == "folder-set":
        db.set_prebrief_folder(conn, folder_key(conn, argv[1]), argv[2])
        print("ok")
    elif cmd == "published":
        p = db.update_prebrief(conn, argv[1], artifact_id=argv[2], folder_id=argv[3])
        print(f"prebrief #{p['id']} published as {p['artifact_id']}" if p else f"no prebrief {argv[1]}")
    elif cmd == "link":
        p = db.update_prebrief(conn, argv[1], debrief_id=int(argv[2]))
        print(f"prebrief #{p['id']} prepared debrief #{p['debrief_id']}" if p else f"no prebrief {argv[1]}")
    elif cmd == "archive":
        p = db.archive_prebrief(conn, argv[1], " ".join(argv[2:]))
        if not p:
            sys.exit(f"no prebrief {argv[1]}")
        print(f"prebrief #{p['id']} archived")
        if p["artifact_id"]:
            print(f"Now move the artifact: update_artifact id {p['artifact_id']} folder_id "
                  + (p["folder_id"] or "<the archive folder; none yet: `prebrief.py folder archive`, then archive again>"))
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
