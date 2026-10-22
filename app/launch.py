"""Start a new agent session from the API server, by calling the platform's `schedule_once` with no `at` (= run now, in a fresh session).

The page can only send a prompt into the chat that is already open (`platform.sendPrompt`), so a button that must
open a session of its own goes through the server instead. Used by the Debrief button.

  python3 app/launch.py debrief <id> [--dry-run]   print (or start) the session for a proposed debrief
"""
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ENTRY_FILE = os.path.expanduser("~/.platform/platform-mcp-entry.json")
TIMEOUT = 20


def mcp_url():
    """The platform MCP endpoint of this agent: from the environment, else the file the platform writes in the pod."""
    url = os.environ.get("PLATFORM_MCP_URL")
    if url:
        return url
    try:
        with open(ENTRY_FILE, encoding="utf-8") as f:
            return json.load(f)["url"]
    except (OSError, KeyError, ValueError):
        return None


def _post(url, payload):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", "accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        text = res.read().decode()
    for line in text.splitlines():  # the answer arrives as one server-sent event
        if line.startswith("data: "):
            return json.loads(line[6:])
    return json.loads(text)


def call_tool(name, arguments):
    """Call one platform-outbound tool. Returns its text result; raises RuntimeError with the platform's reason on failure."""
    url = mcp_url()
    if not url:
        raise RuntimeError("platform MCP endpoint not found (PLATFORM_MCP_URL, ~/.platform/platform-mcp-entry.json)")
    try:
        answer = _post(url, {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}})
    except OSError as e:
        raise RuntimeError(f"couldn't reach the platform: {e}") from e
    if "error" in answer:
        raise RuntimeError(answer["error"].get("message", str(answer["error"])))
    result = answer.get("result", {})
    text = "\n".join(c.get("text", "") for c in result.get("content", []) if c.get("type") == "text")
    if result.get("isError"):
        raise RuntimeError(text or "the platform refused the call")
    return text


def debrief_task(d):
    """The prompt the new session starts with."""
    return (
        f"Debrief of the meeting “{d['title']}” (debrief #{d['id']}). "
        f"Read /home/agent/work/AGENTS.md, then follow the debrief skill, /home/agent/work/.claude/skills/debrief/SKILL.md, "
        f"for this meeting. Start with `python3 /home/agent/work/app/sweep.py debrief-show {d['id']}`, "
        f"which prints the meeting and where its transcript is. "
        f"Talk it through with the owner before writing anything beyond what the skill allows.")


def start_debrief_session(d, dry_run=False):
    """Open a session for debrief `d` (a row of the debriefs table). Returns what the platform said, or the request when dry."""
    args = {"name": f"Debrief: {d['title']}"[:200], "task": debrief_task(d), "sessionTitle": f"Debrief: {d['title']}"[:200]}
    if dry_run or os.environ.get("WSA_LAUNCH_DRY_RUN") == "1":
        return json.dumps(args, ensure_ascii=False, indent=1)
    return call_tool("schedule_once", args)


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    import db
    if len(sys.argv) >= 3 and sys.argv[1] == "debrief":
        conn = db.connect()
        row = db.get_debrief(conn, sys.argv[2])
        if not row:
            sys.exit(f"no debrief {sys.argv[2]}")
        print(start_debrief_session(row, dry_run="--dry-run" in sys.argv))
    else:
        print(__doc__)
        sys.exit(2)
