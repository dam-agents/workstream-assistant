# Workstream Assistant

A [DAM](https://github.com/dam-agents/dam) Starter Kit for an agent that helps you deliver the goals of the workstreams you drive, day by day.

It reads GitHub, Slack and meeting transcripts and keeps a live **Workstreams** app up to date:

- **Workstreams** (`W1`, `W2`, …): one initiative each, with a goal, an owner, a status, a TL;DR and key points.
- **Asks**: what needs *you*, shown as **Needs you**.
- **Follow-ups**: quick open loops, with who has the next move.
- **Progress**: the evidence timeline (PRs, tickets, messages, meetings, releases), every entry linked to its source.

The agent suggests new workstreams for you to approve or reject, and remembers why you rejected one. Each ask and follow-up carries a done check (an issue closed, a PR merged, a release with notes, …), so the agent closes it itself when GitHub shows it's finished.

## Use it

Pick **Workstream Assistant** from your install's Starter Kit catalog. The platform asks for the connections, creates the agent and its schedules, and opens an onboarding session (`ONBOARDING.md`) that asks for your name, timezone, repository, Slack user and channels, then suggests your first workstreams.

| Connection | | Used for |
|---|---|---|
| GitHub | required | Issues, PRs, tags, releases; the done checks |
| Slack (your user) | optional | Your messages, mentions, watched channels |
| Meeting transcripts (MCP) | optional | Meetings: who decided or promised what |

| Schedule (weekdays) | |
|---|---|
| Slack sweep | hourly, 08:07–18:07 |
| Meeting sweep | every 2 h, 09:37–19:37 |
| Close finished items | every 20 min; wakes the agent only when a done check passes |

The agent stays read-only outside its sandbox: it never posts, comments, closes issues or shares artifacts without asking.

## Layout

| Path | What |
|---|---|
| `kit.yaml` | The Starter Kit: connections, schedules, seed |
| `AGENTS.md` (`CLAUDE.md` → it) | The agent's instructions and glossary |
| `ONBOARDING.md` | The first session's runbook |
| `procedures/` | What each schedule does; edit these to change behaviour |
| `app/` | SQLite store, API server (:5555), UI template, done checks, sweep bookkeeping; see [`app/README.md`](app/README.md) |
| `config.example.json` | Shape of the instance's `config.json` (git-ignored, written at onboarding) |

## Develop

```sh
export WSA_DB=/tmp/wsa/wsa.db WSA_CONFIG=/tmp/wsa/config.json
mkdir -p /tmp/wsa && cp config.example.json "$WSA_CONFIG"
python3 -c "import sys, json; sys.path.insert(0, 'app'); import suggest; json.dump(suggest.EXAMPLE, open('/tmp/wsa/s.json', 'w'))"
python3 app/suggest.py /tmp/wsa/s.json
python3 app/server.py &            # http://127.0.0.1:5555/api/summary
python3 app/build.py               # app/app.html with a snapshot
```

Python 3.9+ standard library only; `gh` for the done checks.
