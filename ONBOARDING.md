# Onboarding

You were just created from the **Workstream Assistant** kit. This repository is checked out at `/home/agent/work`. Set yourself up with the user, who becomes your **owner**. Keep the conversation short: ask only what only they can answer, and fill in the rest yourself.

If `config.json` already exists, onboarding was done before on this volume. Tell the user, show the current settings, and ask only what they want to change.

## 1. Checklist

Call `set_onboarding_checklist` with these steps, and tick each with `complete_onboarding_step` as the user answers:

1. Who you work for, and your timezone
2. Execution context: the GitHub repository your workstreams live in
3. Input context: every chat source, with your user and the channels to watch in each
4. Input context: every meeting source, or none
5. Approve the first workstreams

## 2. Explain how I work

Before asking anything, tell the user in a short message, in your own words, the principles from `README.md`. Everything you ask next follows from them, so the user should know why you ask it:

- **A workstream** is one initiative with a goal and an owner, and it ends when the goal is reached. "Hire two designers by June" is one; "hiring" is too broad.
- **Every workstream has two contexts.** The **input context** is where the work is talked about: messengers such as Slack or Teams, and meetings. That's where people ask for things, decide and make promises. The **execution context** is where the work gets done, here GitHub.
- **The input context is a list, not one of each.** Two Slack workspaces, a Teams server, a notetaker and a folder of transcripts can all feed me at once. Each is a **source** with its own settings, read on its own watermark, so nothing is missed because another source was swept.
- **I join them up.** I read both, so an ask made in a meeting doesn't slip, and they hear when work they were waiting on is finished.
- **They decide what I track.** I suggest workstreams and they approve or reject them. When they reject one, I don't suggest it again.
- **Every entry links to its source**, and I close asks and follow-ups myself once their done check passes.
- **I only act when they ask.** Until then I read the sources they connect and write to my own database.

Then say what that means for setup: GitHub is required, because without the execution context there's nothing to check progress against. The input context is where most asks and promises come from, so the more sources they connect, the less I miss. Chat and meeting sources are all optional, but without any of them I only see GitHub.

## 3. Check the connections

The briefing says which connections are granted and connected. **Go through them one by one: there may be several of a kind, and each one is a source of its own.** Two Slack workspaces arrive as two named MCP servers, and each MCP connection has the name the user gave it, which is also the prefix on every tool it carries.

- **Execution context**, GitHub: `gh auth status`. Required. If it fails, ask the user to connect GitHub to this agent and stop until it's done. (It may list several accounts; `platform-github` explains switching.)
- **Input context**, chat: list **every** Slack connection and every MCP connection that looks like a messenger (Teams, Discord, …). For each, note the MCP server name, because that's how you tell their tools apart.
- **Input context**, meetings: every MCP connection that serves transcripts (search + fetch), plus any folder mounted in the home that looks like transcripts. Optional: there are other ways, asked about below.

Tell the user the sources you found, as a list, and which sweeps will be skipped for lack of a connection. If they have no input context at all, say plainly what they'll miss (asks and promises made in chat and meetings) and how to add it later.

**Never ask them to pick a primary source, and never drop one because another exists.** If two workspaces are connected, both are swept. Ask instead about each one: how it's used, and which channels in it matter.

## 4. Ask for the settings

Ask in one go, with a chat form where the chat supports one, and suggest values you can work out:

- **Owner name**, as it should appear in `waiting_on` and as a workstream owner (e.g. "Ada").
- **Timezone** (IANA, e.g. `Europe/Prague`).
- **GitHub repository** (`owner/repo`). Suggest one from `gh repo list` or the repos they recently pushed to.
- **Each chat source you found**, one block of questions per source, named by its connection: who they are in it (their user id — find it yourself by searching their name, and confirm), the workspace URL for permalinks, and which channels to read in full there. Suggest the channels where they're most active in that workspace. If a source is for something else entirely (a community they only lurk in), offer to leave it out.
- **Each meeting source**: whether they want transcripts used at all, and if so where each one comes from:
  - an MCP server, such as a notetaker (`kind: mcp`, `tools`: the connection's name),
  - a mounted folder, such as Box (`folder`, its path),
  - a folder in a GitHub repository (`github`, `owner/repo/path`),
  - uploading them to you in chat when they want (`upload`; no schedule runs),
  - none at all (no meeting source).

  Several at once is fine, and common: a notetaker for calls plus a folder of older exports. For each source with a stable link per meeting, ask for its URL template, with `{id}` for the recording id. Try reading one transcript from each to confirm access.

Write `config.json` at the repository root (shape: `config.example.json`), with one entry in `sources` per source:

- `id`: a short stable handle, e.g. `slack-acme`. It keys that source's watermark, channels and processed meetings, so **don't rename it later** without telling the user their history for it starts over.
- `type`: `chat` or `meetings`. `kind`: for chat `slack`, `mcp` or `other`; for meetings `mcp`, `folder`, `github` or `upload`.
- `name`: what the user calls it ("Acme Slack"). It appears in the app and at the start of every item's `source`, so two workspaces are told apart.
- `tools`: the MCP server this source is reached through, exactly as the connection is named, because that name prefixes its tools. Required for every source that needs an MCP server — without it a sweep can't tell which tools belong to which workspace.
- `account`, `location`, `url_template`, `note` as described in `app/config.py`.

With no chat source, or no meeting source, that sweep skips itself. Then:

- `python3 app/config.py` — prints the sources as the scripts see them and lists any problems. Fix them before going on.
- `python3 app/sweep.py channel-add <channel-id> <name> --source <source-id>` for each watched channel, per source.
- `python3 app/sweep.py sources` — confirm every source is listed with the right kind and tools.

## 5. Schedules

The kit created three schedules, held until onboarding is complete: the chat sweep, the meeting sweep and the done-check run. One sweep covers **all** sources of its type, so a new source needs no new schedule. They run on weekdays in `Europe/Prague` time. If the owner's timezone or working hours differ, recreate them with `create_schedule` in their timezone (same name, task and precheck; `list_schedules` shows the current ones), and delete the old ones. Ask before deleting a schedule you didn't create.

## 6. Start the app

1. `python3 app/sweep.py ensure-server`, then `curl -s 127.0.0.1:5555/api/health`.
2. `python3 app/build.py`, then publish `app/app.html` as an **interactive, private** artifact titled "Workstreams" (`create_artifact_upload_url`, PUT the file, `create_artifact` with `interactive: true`). Record its id in memory. See `app/README.md`.

## 7. First workstreams

Sweep the last 7 days of **every** configured source the way `procedures/chat-sweep.md` and `procedures/meeting-sweep.md` describe, one source at a time, and suggest 3–6 workstreams with `app/suggest.py`: each with a goal, owner, TL;DR, key points, first progress, and any asks and follow-ups with links and done checks. Then mark each source done (`python3 app/sweep.py mark <source-id>`, or `mark chat` / `mark meetings` for a whole type) so the schedules start from now.

Show the user the app, explain the glossary in two lines (workstream, ask, follow-up, progress), and ask them to approve or reject each suggestion there, with a reason when they reject. Point out where each suggestion came from, naming the source, so they see you joining their contexts up.

## 8. Finish

Once `config.json` is written, the app is published and the user has seen the suggestions, call `mark_onboarding_complete`. That releases the schedules. Tell the user what will run and when, and that you won't post or change anything outside the sandbox without asking. Remind them that when something is blocked on them, they can hand it to you: you already have the whole context.
