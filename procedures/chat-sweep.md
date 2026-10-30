# Procedure: chat sweep

Run by the schedule **Workstream Assistant: chat sweep**. It reads **every chat source** in `config.json`: one Slack workspace, two of them, a Teams or Discord MCP server, or any mix. The precheck output (from `app/sweep.py state chat`) gives you the owner, the server status, and then one block per source with its own watermark, its own tools, the owner's account there and the channels to read in full. It ends with the open asks, follow-ups and deadlines with their done-check results, the overdue deadlines, and the rejected workstreams. All paths are relative to `/home/agent/work`.

1. If the API server is reported DOWN, run `python3 app/sweep.py ensure-server`. If the precheck lists configuration problems, tell the owner; don't work around them (no guessing another workspace, no reading a source that isn't configured).
2. **Sweep each source listed under "Sources to sweep in this run", one at a time.** Keep them apart: a source has its own tools, its own ids and its own watermark.
   - **Use only that source's tools.** The precheck names the MCP server each source is reached through (`tools`), and every tool it carries is prefixed with that name. Reading workspace A with workspace B's tools either fails or returns the wrong workspace's messages.
   - **Read since that source's watermark**, with the unix time from its block as `oldest`/`after`. A source that has never been swept says so: read about 7 days back, from the time its block gives.
   - **Watched channels:** read every new message in each channel listed for that source. Open threads with new replies when they matter. Most workstream progress happens here, even when the owner isn't in the conversation.
   - **The owner's own messages anywhere:** search `from:<@USER>` with the account from that source's block, including DMs and group DMs outside those channels.
   - **Mentions of the owner:** `<@USER>` in messages from others.
   - Respect the source's `note` (e.g. a partner workspace where you ask before searching private channels).
   - Space the calls out, because these APIs are rate-limited. If you hit a limit, finish what you have, mark the sources you did finish, and say so.
3. Skip anything that isn't about the owner's workstreams (see "Stay on topic" in AGENTS.md).
4. Update the database with the helpers in `app/db.py`. One workstream may be discussed in several sources; that's normal, and the progress entries just say where each piece came from.
   - progress for approved and suggested workstreams (`add_progress`)
   - asks for anything that needs the owner (`add_ask`), and follow-ups from their short requests and questions (`add_followup`). Tie a follow-up to a workstream only if it clearly belongs to one. **Give every new item its link and a done check** (`check_spec` and/or `done_when`), then confirm it reads correctly with `python3 app/checks.py list`.
   - **Name the source in every item.** Start the `source` field with the configured source name, e.g. `Acme Slack #release` or `Partner Slack DM`, so the owner can tell two workspaces apart. Build the link from that source's own `location` (its workspace URL), never another's.
   - close loops: resolve items whose check shows DONE in the precheck, and items marked "judge" whose `done_when` you can now see happened (`resolve_ask` / `resolve_followup`)
   - **re-read the source thread of every open "judge" item** whose URL belongs to a source you're sweeping (its read-thread tool, on the item's channel + ts). A reply inside an older thread never appears as a new channel message, so the channel read alone misses it. If the reply or filed issue meets `done_when`, resolve the item. Don't make the bar stricter than `done_when` (e.g. "issue filed" counts; don't wait for the PR to merge).
   - **deadlines**: when a workstream milestone gets a date, `add_deadline`; when the date changes, `move_deadline` (see Deadlines in AGENTS.md). Deal with every one the precheck lists as overdue: close it as met or missed, or move it. A deadline the precheck shows as DONE is met: `close_deadline(conn, id, "met")`.
   - check GitHub (`gh`, repo `github_repo`) when a ticket or PR state matters, and its milestones (`due_on`) for dates
   - **who is away**, when the precheck lists availability sources: use the **who-is-away** skill for the people the open work waits on, and record what it finds as step 5 of "Refreshing workstreams" in AGENTS.md says.
   - for any workstream that changed: rewrite tldr, key_points, status and status_note (`update_workstream`)
5. New candidate workstreams: only if it's clearly a goal with an owner and the owner of this agent is involved. Never anything rejected or close to it. Add as `suggested` (`app/suggest.py`).
6. Stay read-only outside the database: no messages posted in any source, no GitHub changes, no sharing.
7. **Mark each source as you finish it**, only after the database is updated for it: `python3 app/sweep.py mark <source-id>`. Marking per source means a source that failed or hit a rate limit keeps its gap for the next run, instead of being skipped because another source succeeded.
8. Finish with a 3–6 line summary of what changed, using refs (W1, W2…), or "No changes". Name the source when it matters ("in Partner Slack"). If something new needs the owner, put it first. Say which sources you couldn't finish.
