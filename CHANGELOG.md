# Changelog

What changed in the kit, newest first, one entry per merged pull request.
It's written for two readers: the owner, who wants to know what's new, and the agent of an existing instance, which needs to know what to do after a Kit Update.
An entry's **After updating** line is that to-do list; when it's missing, there's nothing to do.

New entries go under **Unreleased** in the pull request that makes the change (see "Changing the kit" in `AGENTS.md`), and get their date when they merge.

## Unreleased

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
