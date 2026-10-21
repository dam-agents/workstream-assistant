"""Close loops automatically: each open ask / follow-up can carry a done check (check_spec, JSON).

  python3 app/checks.py list               every open item with its check and current result
  python3 app/checks.py verify             run the checks, print what passes, change nothing
  python3 app/checks.py verify --apply     resolve the items whose check passes (adds "Done:" progress entries)
  python3 app/checks.py precheck           for the schedule: print passing items, exit 0 if any, else exit 1

Check types (all against config.json's github_repo unless "repo" is given):
  {"type": "gh_issue_closed", "number": 4700}
  {"type": "gh_pr_merged", "number": 5402}
  {"type": "gh_sub_issues", "number": 4403, "min": 2}
  {"type": "gh_search", "query": "hibernat in:title created:>=2026-10-19 is:closed", "min": 1}
  {"type": "gh_tag", "prefix": "v0.2.23", "contains": "v0.2.22-rc1"}            a tag with that prefix includes the ref
  {"type": "gh_release", "prefix": "v0.2.23", "contains": "v0.2.22-rc1"}        a release (draft or not) with notes, on such a tag
  {"type": "all", "checks": [ ... ]}                                            every sub-check passes
  {"type": "cmd", "cmd": "<shell>"}                                             exit 0 = done
Items without a check_spec are verified by judgment during the sweeps (done_when says what to look for).
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db  # noqa: E402
from config import CFG  # noqa: E402

REPO = CFG["github_repo"]


def sh(args, timeout=30):
    r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[:200])
    return r.stdout.strip()


def gh_json(args):
    return json.loads(sh(["gh", *args]) or "null")


def contains(repo, ref, tag):
    try:
        return sh(["gh", "api", f"repos/{repo}/compare/{ref}...{tag}", "--jq", ".status"]) in ("ahead", "identical")
    except RuntimeError:
        return False


def tags_with_prefix(repo, prefix):
    names = gh_json(["api", f"repos/{repo}/tags?per_page=100", "--jq", "[.[].name]"]) or []
    return [n for n in names if n.startswith(prefix)]


def run_check(spec):
    """Return (done: bool, detail: str)."""
    t, repo = spec["type"], spec.get("repo", REPO)
    if t == "gh_issue_closed":
        st = gh_json(["issue", "view", str(spec["number"]), "-R", repo, "--json", "state"])["state"]
        return st == "CLOSED", f"#{spec['number']} is {st.lower()}"
    if t == "gh_pr_merged":
        st = gh_json(["pr", "view", str(spec["number"]), "-R", repo, "--json", "state"])["state"]
        return st == "MERGED", f"PR #{spec['number']} is {st.lower()}"
    if t == "gh_sub_issues":
        n = len(gh_json(["api", f"repos/{repo}/issues/{spec['number']}/sub_issues"]) or [])
        return n >= spec.get("min", 1), f"#{spec['number']} has {n} sub-issues (need {spec.get('min', 1)})"
    if t == "gh_search":
        hits = gh_json(["search", "issues", spec["query"], "--repo", repo, "--json", "number,title", "--limit", "10"]) or []
        return len(hits) >= spec.get("min", 1), (", ".join(f"#{h['number']}" for h in hits) or "no matches")
    if t == "gh_tag":
        good = [n for n in tags_with_prefix(repo, spec["prefix"]) if contains(repo, spec["contains"], n)]
        return bool(good), (f"{', '.join(good)} include {spec['contains']}" if good else f"no {spec['prefix']}* tag includes {spec['contains']} yet")
    if t == "gh_release":
        rels = gh_json(["release", "list", "-R", repo, "--limit", "20", "--json", "tagName,isDraft"]) or []
        for r in rels:
            tag = r["tagName"]
            if not tag.startswith(spec["prefix"]):
                continue
            if spec.get("contains") and not contains(repo, spec["contains"], tag):
                continue
            body = gh_json(["release", "view", tag, "-R", repo, "--json", "body"])["body"].strip()
            if body:
                return True, f"release {tag} has notes ({'draft' if r['isDraft'] else 'published'})"
        return False, f"no {spec['prefix']}* release with notes" + (f" on a tag including {spec['contains']}" if spec.get("contains") else "")
    if t == "all":
        details = []
        for sub in spec["checks"]:
            ok, d = run_check(sub)
            details.append(d)
            if not ok:
                return False, "; ".join(details)
        return True, "; ".join(details)
    if t == "cmd":
        r = subprocess.run(["bash", "-lc", spec["cmd"]], capture_output=True, text=True, timeout=30)
        return r.returncode == 0, (r.stdout.strip()[:120] or f"exit {r.returncode}")
    raise ValueError(f"unknown check type {t}")


def open_items(conn):
    items = []
    for kind in ("asks", "followups"):
        for r in conn.execute(f"SELECT * FROM {kind} WHERE done_at IS NULL ORDER BY id"):
            items.append((kind, dict(r)))
    return items


def evaluate(conn):
    out = []
    for kind, it in open_items(conn):
        if not it.get("check_spec"):
            out.append((kind, it, None, it.get("done_when") or "no check, verify by judgment"))
            continue
        try:
            ok, detail = run_check(json.loads(it["check_spec"]))
        except Exception as e:  # a broken check must not stop the others
            ok, detail = None, f"CHECK ERROR: {e}"
        out.append((kind, it, ok, detail))
    return out


def label(kind, it):
    where = it.get("workstream_id") or "loose"
    return f"[{'ask' if kind == 'asks' else 'follow-up'} {it['id']} · {where}] {it['text']}"


def main():
    conn = db.connect()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    results = evaluate(conn)
    passing = [(k, it, d) for k, it, ok, d in results if ok]
    if cmd == "list":
        for k, it, ok, d in results:
            mark = {True: "DONE ", False: "open ", None: "  ?  "}[ok]
            print(f"{mark} {label(k, it)}\n       {d}")
    elif cmd in ("verify", "precheck"):
        apply = "--apply" in sys.argv
        for k, it, d in passing:
            print(f"DONE {label(k, it)}: {d}")
            if apply:
                (db.resolve_ask if k == "asks" else db.resolve_followup)(conn, it["id"])
        for k, it, ok, d in results:
            if ok is None and d.startswith("CHECK ERROR"):
                print(f"{label(k, it)}: {d}", file=sys.stderr)
        if cmd == "precheck":
            sys.exit(0 if passing else 1)
        if not passing:
            print("Nothing newly done.")
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
