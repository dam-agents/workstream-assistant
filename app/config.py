"""Instance settings, written by onboarding to config.json at the repo root (git-ignored). See config.example.json."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.environ.get("WSA_CONFIG", os.path.join(ROOT, "config.json"))

DEFAULTS = {
    "owner": "",                # the person this agent works for, as it appears in waiting_on / owner fields
    "timezone": "UTC",          # IANA zone for timestamps and schedules
    "github_repo": "",          # default repo for done checks and #123 links, e.g. dam-agents/dam
    "slack": {"user_id": "", "workspace_url": ""},  # e.g. U0123456789, https://acme.slack.com
    "meetings": {"source": "", "url_template": ""},  # e.g. "Brainio", https://brain.example.com/?recording={id}
    "port": 5555,               # the only port interactive artifacts can reach
}


def load():
    cfg = json.loads(json.dumps(DEFAULTS))
    if os.path.exists(PATH):
        with open(PATH, encoding="utf-8") as f:
            for k, v in json.load(f).items():
                cfg[k] = {**cfg[k], **v} if isinstance(cfg.get(k), dict) and isinstance(v, dict) else v
    return cfg


CFG = load()
