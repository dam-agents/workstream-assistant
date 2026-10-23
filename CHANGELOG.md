# Changelog

What changed in the kit, newest first, one entry per merged pull request.
It's written for two readers: the owner, who wants to know what's new, and the agent of an existing instance, which needs to know what to do after a Kit Update.
An entry's **After updating** line is that to-do list; when it's missing, there's nothing to do.

New entries go under **Unreleased** in the pull request that makes the change (see "Changing the kit" in `AGENTS.md`), and get their date when they merge.

## Unreleased

### Prebrief: prepare a call, then debrief against it

- New **prebrief** skill: say "prebrief the call with Cleo", or click **Prebrief a call** on a workstream page. We iterate on a short document (goal, what to raise, what to ask, what to watch for), and the agent publishes it as a private markdown artifact in that workstream's folder, **Prebriefs · W3 …**.
- The workstream page lists its open prebriefs. **Open** asks the agent for the link and to carry on.
- The debrief finds the prebrief for its meeting (`debrief-show` lists it), opens with how the call went against the plan, and moves the artifact to **Prebriefs · Archive** when it's done.
- New `prebriefs` table (created on the next `db.connect()`), `app/prebrief.py`, and `data/prebriefs/` for the working copies.

**After updating:** republish the app (`app/README.md`, Publishing), and restart the API server.

### Debrief isn't marked started when the prompt never arrives

- On an empty "Start a new session" screen the platform drops the prompt ("Open a chat before using this artifact's buttons"), but the row still said **Started**. Now the agent marks the debrief started when the prompt reaches it, and the page reminds you to open a chat first if nothing arrives.

**After updating:** republish the app (`app/README.md`, Publishing), and restart the API server.

### Debrief runs in the open chat ([#9](https://github.com/dam-agents/workstream-assistant/pull/9))

- **Debrief** now sends the debrief prompt into the chat beside the dashboard, like **Ask agent to refresh**, instead of opening a new session. Opening a session relied on a platform tool (`schedule_once`) that isn't available, so the button failed with "Tool schedule_once not found".
- `POST /api/debriefs/:id/start` marks the debrief started and returns the prompt; `app/launch.py` is gone.
- For a clean thread, open a new chat first and click **Debrief** there.

**After updating:** republish the app (`app/README.md`, Publishing). Until you do, the published page still calls the old flow and the button keeps failing.

### The app page knows when a Kit Update left it behind ([#7](https://github.com/dam-agents/workstream-assistant/pull/7))

- The page carries the version of the template it was built from. When the template on disk is newer, the page shows an **out of date** banner with **Ask agent to republish**, and `ensure-server` and every sweep's precheck print `App page: STALE`.

**After updating:** republish the app once. Pages published before this change carry no version, so the check can't tell until then.

## 2026-10-22

### The input context is a list of sources ([#6](https://github.com/dam-agents/workstream-assistant/pull/6))

- `config.json` holds a `sources` list: any number of chat and meeting sources (two Slack workspaces, a Teams server, a notetaker, a transcript folder), each with its own id. Onboarding no longer asks which Slack workspace is primary.
- Watermarks, watched channels, processed meetings and debriefs are kept per source, so one failing source keeps its own gap for the next run.
- The Slack sweep is now the **chat sweep** (`procedures/chat-sweep.md`, precheck `state chat`). `procedures/slack-sweep.md` and `state slack` remain as aliases.
- The database migrates itself on the next `db.connect()`, and a legacy `config.json` with `slack`/`meetings` objects is still read.

**After updating:**
- Recreate the **Slack sweep** schedule as **chat sweep** (see "Scheduled runs" in `AGENTS.md`), keeping its rrule and timezone, then delete the old one.
- Optionally rewrite `config.json` into the `sources` shape (`config.example.json`), and run `python3 app/config.py` to check it.
- Republish the app (`app/README.md`, Publishing): debrief rows now show their source.

### Debrief ([#5](https://github.com/dam-agents/workstream-assistant/pull/5))

- The meeting sweep no longer changes workstreams. It **proposes** a meeting for debrief, and the dashboard shows it under **Debriefs**.
- **Debrief** opens a new session where the `debrief` skill talks the meeting through with the owner and writes only what they agree to.
- New `debriefs` table, `sweep.py debrief-*` commands and `/api/debriefs` routes.

**After updating:** republish the app. Until you do, the published page has no Debriefs section and proposed debriefs stay invisible.

## 2026-10-21

### Source-agnostic meeting transcripts ([#4](https://github.com/dam-agents/workstream-assistant/pull/4))

- Meeting transcripts are optional. They can come from an MCP server, a mounted folder, a GitHub repository or chat uploads.
- The meeting sweep's precheck skips the run when there's nothing new.
- Onboarding explains the principles before asking anything.

**After updating:** nothing required; a config that only set `meetings.source` still reads as `mcp`.

### Slack sweep re-reads source threads ([#3](https://github.com/dam-agents/workstream-assistant/pull/3))

- Open "judge" items with a Slack link get their thread re-read, so an answer posted inside an older thread closes them.

### README and hero ([#1](https://github.com/dam-agents/workstream-assistant/pull/1), [#2](https://github.com/dam-agents/workstream-assistant/pull/2))

- The README explains workstreams, input context and execution context first, and has a hero image. It says the agent can do blocked work for you when you ask.
