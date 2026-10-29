"""Instance settings, written by onboarding to config.json at the repo root (git-ignored). See config.example.json.

The input context is a **list of sources**: as many as the owner has. Two Slack workspaces, a Teams
MCP server, a notetaker and a folder of transcripts can all be configured at once, each with its own
id, and each swept on its own watermark.

  python3 app/config.py        print the settings as the scripts see them, with any problems found
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.environ.get("WSA_CONFIG", os.path.join(ROOT, "config.json"))

DEFAULTS = {
    "owner": "",                # the person this agent works for, as it appears in waiting_on / owner fields
    "timezone": "UTC",          # IANA zone for timestamps and schedules
    "github_repo": "",          # default repo for done checks and #123 links, e.g. dam-agents/dam
    "sources": [],              # the input context: every chat and meeting source, see SOURCE below
    "port": 5555,               # the only port interactive artifacts can reach
}

# One entry of "sources". Every field is optional except type and kind.
SOURCE = {
    "id": "",            # stable short handle, e.g. "slack-acme". Keys this source's sweep watermark, channels and seen meetings: renaming it starts its history over
    "type": "",          # "chat" (a messenger, swept by the chat sweep), "meetings" (transcripts, swept by the meeting sweep) or "availability" (who is away: a vacation or leave calendar the agent reads itself)
    "kind": "",          # chat: slack, mcp, other · meetings: mcp, folder, github, upload · availability: ical, mcp, other
    "name": "",          # what the owner calls it, e.g. "Acme Slack". Used in the app and in every `source` field
    "tools": "",         # the MCP server this source is reached through, as named in the connection: every tool it carries is prefixed with it. Empty when it needs no MCP server (folder, github)
    "account": "",       # who the owner is in it, e.g. a Slack user id U0123456789
    "location": "",      # workspace URL, folder path, owner/repo/path, the MCP server's own name for its content, or an iCal feed URL (a private token: never shown in full)
    "url_template": "",  # link to one item, with {id} for the recording / message id. Empty = use the item's own link
    "note": "",          # anything the sweeps must know about this source, e.g. "partner workspace, ask before searching private channels",
                         # or for a calendar how its entries read, e.g. "SUMMARY is '<Name> - <Vacation|Sick day|…>'; holidays have no name"
}

CHAT_KINDS = ("slack", "mcp", "other")
MEETING_KINDS = ("mcp", "folder", "github", "upload")
AVAILABILITY_KINDS = ("ical", "mcp", "other")
TYPES = ("chat", "meetings", "availability")
KINDS = {"chat": CHAT_KINDS, "meetings": MEETING_KINDS, "availability": AVAILABILITY_KINDS}
LEGACY_SWEEP_KEY = {"chat": "last_sweep_slack", "meetings": "last_sweep_meetings"}


def _slug(text, fallback):
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return s or fallback


def _legacy_sources(cfg):
    """Sources from a pre-list config: one `slack` object and one `meetings` object."""
    out = []
    sl = cfg.get("slack") or {}
    if sl.get("user_id") or sl.get("workspace_url"):
        out.append({"id": "slack", "type": "chat", "kind": "slack", "name": "Slack",
                    "account": sl.get("user_id", ""), "location": sl.get("workspace_url", "")})
    mt = cfg.get("meetings") or {}
    kind = mt.get("kind") or ("mcp" if mt.get("source") else "")
    if kind:
        out.append({"id": "meetings", "type": "meetings", "kind": kind, "name": "Meetings",
                    "location": mt.get("location") or mt.get("source", ""),
                    "url_template": mt.get("url_template", "")})
    return out


def _normalize(raw):
    """Fill in every field, infer what can be inferred, and keep ids unique."""
    out, seen = [], set()
    for i, src in enumerate(raw):
        s = {**SOURCE, **{k: v for k, v in (src or {}).items() if k in SOURCE}}
        s["kind"] = (s["kind"] or "").strip().lower()
        s["type"] = (s["type"] or "").strip().lower()
        if not s["type"]:  # a kind that belongs to only one type says the type by itself
            s["type"] = "chat" if s["kind"] == "slack" else ("meetings" if s["kind"] in ("folder", "github", "upload")
                                                              else "availability" if s["kind"] == "ical" else "")
        s["name"] = s["name"] or s["id"] or (s["kind"] or "source").title()
        s["id"] = _slug(s["id"] or s["name"], f"source-{i + 1}")
        while s["id"] in seen:  # two sources may not share a watermark
            s["id"] += "-2"
        seen.add(s["id"])
        out.append(s)
    return out


def load():
    cfg = json.loads(json.dumps(DEFAULTS))
    raw = {}
    if os.path.exists(PATH):
        with open(PATH, encoding="utf-8") as f:
            raw = json.load(f)
        for k, v in raw.items():
            cfg[k] = {**cfg[k], **v} if isinstance(cfg.get(k), dict) and isinstance(v, dict) else v
    cfg["sources"] = _normalize(cfg.get("sources") or _legacy_sources(raw))
    return cfg


CFG = load()


def sources(type_=None, kind=None):
    """Configured sources, optionally only those of one type ("chat", "meetings") or kind."""
    return [s for s in CFG["sources"]
            if (type_ is None or s["type"] == type_) and (kind is None or s["kind"] == kind)]


def source(key, type_=None):
    """One source by id, or by name (case-insensitive). None if there's no such source."""
    k = str(key).strip().lower()
    for s in sources(type_):
        if s["id"] == k or s["name"].lower() == k:
            return s
    return None


def only_source(type_):
    """The single source of this type, when there is exactly one; else None (the caller must name one)."""
    got = sources(type_)
    return got[0] if len(got) == 1 else None


def label(src):
    """How this source is named to the owner, and in every `source` field of an item: "Acme Slack (slack)"."""
    return f"{src['name']} ({src['kind'] or 'unknown kind'})"


def masked(src):
    """A source's location as it may be shown: an iCal feed URL is a private token, so its secret part is hidden."""
    if src["kind"] != "ical":
        return src["location"]
    return re.sub(r"([^/?=&]{6})[^/?=&]{6,}", r"\1…", src["location"])


def ids(type_=None):
    return [s["id"] for s in sources(type_)]


def problems():
    """What's wrong with the configured sources, as lines to show the owner. Empty = nothing found."""
    out = []
    if not CFG["owner"]:
        out.append("owner is not set: follow ONBOARDING.md")
    if not CFG["github_repo"]:
        out.append("github_repo is not set: the done checks have no default repository")
    for s in CFG["sources"]:
        who = f"source “{s['id']}”"
        if s["type"] not in TYPES:
            hint = (f" — “{s['type']}” is a kind, not a type: set kind to it and type to chat, meetings or availability"
                    if s["type"] in set(CHAT_KINDS + MEETING_KINDS + AVAILABILITY_KINDS) else "")
            out.append(f"{who}: type must be chat, meetings or availability (it is {s['type'] or 'empty'}){hint}")
            continue
        kinds = KINDS[s["type"]]
        if s["kind"] not in kinds:
            out.append(f"{who}: kind {s['kind'] or '(empty)'} is not one of {', '.join(kinds)} for a {s['type']} source")
        # Which MCP server a source is reached through only has to be written down when there's more than
        # one of them to tell apart: a lone Slack is unambiguous, and configs predating the list don't say.
        tool_using = [o for o in CFG["sources"] if o["kind"] in ("mcp", "slack", "other")]
        if s["kind"] in ("mcp", "slack", "other") and not s["tools"] and len(tool_using) > 1:
            out.append(f"{who}: no `tools` — name the MCP server it's reached through, so the sweeps can tell its tools from the other sources'")
        if s["kind"] in ("github", "folder") and not s["location"]:
            out.append(f"{who}: location is required for a {s['kind']} source")
        elif s["kind"] == "folder" and not os.path.isdir(s["location"]):
            out.append(f"{who}: folder {s['location']} not found — it may be unmounted; don't guess another path")
        if s["kind"] == "ical" and not s["location"].startswith(("https://", "http://", "webcal://")):
            out.append(f"{who}: location must be the iCal feed URL")
        if s["type"] == "chat" and s["kind"] == "slack" and not s["location"]:
            out.append(f"{who}: location (the workspace URL) is required to build message permalinks")
        if s["type"] == "chat" and not s["account"]:
            out.append(f"{who}: account is empty — the sweep can't search for the owner's own messages and mentions")
    if not sources("chat") and not sources("meetings"):
        out.append("no input context: no chat or meeting source is configured, so only GitHub is read")
    return out


if __name__ == "__main__":
    print(f"config file: {PATH}{'' if os.path.exists(PATH) else ' (MISSING: follow ONBOARDING.md)'}")
    for k in ("owner", "timezone", "github_repo", "port"):
        print(f"{k}: {CFG[k] or '(not set)'}")
    for type_ in TYPES:
        got = sources(type_)
        print(f"\n{type_} sources ({len(got)}):" if got else f"\n{type_} sources: none")
        for s in got:
            print(f"  [{s['id']}] {s['name']} — kind {s['kind'] or '(none)'}"
                  + (f", tools “{s['tools']}”" if s["tools"] else "")
                  + (f", account {s['account']}" if s["account"] else "")
                  + (f", at {masked(s)}" if s["location"] else ""))
            if s["url_template"]:
                print(f"      links: {s['url_template']}")
            if s["note"]:
                print(f"      note: {s['note']}")
    probs = problems()
    print("\nProblems:" if probs else "\nNo problems found.")
    for p in probs:
        print(f"  - {p}")
    sys.exit(1 if probs else 0)
