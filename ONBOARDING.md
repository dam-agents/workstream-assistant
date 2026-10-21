# Onboarding

You were just created from the **Workstream Assistant** kit. This repository is checked out at `/home/agent/work`. Set yourself up with the user, who becomes your **owner**. Keep the conversation short: ask only what only they can answer, and fill in the rest yourself.

If `config.json` already exists, onboarding was done before on this volume. Tell the user, show the current settings, and ask only what they want to change.

## 1. Checklist

Call `set_onboarding_checklist` with these steps, and tick each with `complete_onboarding_step` as the user answers:

1. Who you work for, and your timezone
2. The GitHub repository your workstreams live in
3. Slack: your user, and the channels to watch
4. Meetings: the transcript source (or skip)
5. Approve the first workstreams

## 2. Check the connections

The briefing says which connections are granted and connected. Confirm what works:

- GitHub: `gh auth status`. Required. If it fails, ask the user to connect GitHub to this agent and stop until it's done.
- Slack: whether Slack MCP tools are available to you. Optional.
- Meetings: whether a meeting-transcript MCP server (search + fetch) is available. Optional.

Tell the user which sources you'll use, and which sweeps will be skipped for lack of a connection.

## 3. Ask for the settings

Ask in one go, with a chat form where the chat supports one, and suggest values you can work out:

- **Owner name**, as it should appear in `waiting_on` and as a workstream owner (e.g. "Ada").
- **Timezone** (IANA, e.g. `Europe/Prague`).
- **GitHub repository** (`owner/repo`). Suggest one from `gh repo list` or the repos they recently pushed to.
- **Slack** (only with a Slack connection): their user id (find it yourself by searching their name and confirm), the workspace URL, and the channels to read in full. Suggest the channels where they're most active.
- **Meetings** (only with a meeting connection): the source's name and the URL template for a recording, with `{id}` for the recording id.

Write `config.json` at the repository root (shape: `config.example.json`). Leave the `slack` or `meetings` fields empty when there's no connection: those sweeps then skip themselves. Add each watched channel with `python3 app/sweep.py channel-add <id> <name>`.

## 4. Schedules

The kit created three schedules, held until onboarding is complete. They run on weekdays in `Europe/Prague` time. If the owner's timezone or working hours differ, recreate them with `create_schedule` in their timezone (same name, task and precheck; `list_schedules` shows the current ones), and delete the old ones. Ask before deleting a schedule you didn't create.

## 5. Start the app

1. `python3 app/sweep.py ensure-server`, then `curl -s 127.0.0.1:5555/api/health`.
2. `python3 app/build.py`, then publish `app/app.html` as an **interactive, private** artifact titled "Workstreams" (`create_artifact_upload_url`, PUT the file, `create_artifact` with `interactive: true`). Record its id in memory. See `app/README.md`.

## 6. First workstreams

Sweep the last 7 days of the configured sources the way `procedures/slack-sweep.md` and `procedures/meeting-sweep.md` describe, and suggest 3–6 workstreams with `app/suggest.py`: each with a goal, owner, TL;DR, key points, first progress, and any asks and follow-ups with links and done checks. Then mark the sweeps done (`app/sweep.py mark slack`, `mark meetings`) so the schedules start from now.

Show the user the app, explain the glossary in two lines (workstream, ask, follow-up, progress), and ask them to approve or reject each suggestion there, with a reason when they reject.

## 7. Finish

Once `config.json` is written, the app is published and the user has seen the suggestions, call `mark_onboarding_complete`. That releases the schedules. Tell the user what will run and when, and that you won't post or change anything outside the sandbox without asking.
