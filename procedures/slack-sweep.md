# Procedure: Slack sweep

Run by the schedule **Workstream Assistant: Slack sweep**. The precheck output (from `app/sweep.py state slack`) gives you the owner, the last sweep time, server status, the channels to read, every open ask and follow-up with its done-check result, and the rejected workstreams. All paths are relative to `/home/agent/work`.

1. If the API server is reported DOWN, run `python3 app/sweep.py ensure-server`.
2. Read Slack activity since the last sweep. Use the unix time from the precheck as `oldest`/`after`. The owner's Slack user id is `slack.user_id` in `config.json`.
   - **Watched channels:** read every new message in each channel listed under "Channels to read in full". Open threads with new replies when they matter. Most workstream progress happens here, even when the owner isn't in the conversation.
   - **The owner's own messages anywhere:** search `from:<@USER>`, including DMs and group DMs outside those channels.
   - **Mentions of the owner:** `<@USER>` in messages from others.
   - Space the calls out, because Slack is rate-limited. If you hit the limit, finish what you have and say so.
3. Skip anything that isn't about the owner's workstreams (see "Stay on topic" in AGENTS.md).
4. Update the database with the helpers in `app/db.py`:
   - progress for approved and suggested workstreams (`add_progress`)
   - asks for anything that needs the owner (`add_ask`), and follow-ups from their short requests and questions (`add_followup`). Tie a follow-up to a workstream only if it clearly belongs to one. **Give every new item its link and a done check** (`check_spec` and/or `done_when`), then confirm it reads correctly with `python3 app/checks.py list`.
   - close loops: resolve items whose check shows DONE in the precheck, and items marked "judge" whose `done_when` you can now see happened (`resolve_ask` / `resolve_followup`)
   - check GitHub (`gh`, repo `github_repo`) when a ticket or PR state matters
   - for any workstream that changed: rewrite tldr, key_points, status and status_note (`update_workstream`)
5. New candidate workstreams: only if it's clearly a goal with an owner and the owner of this agent is involved. Never anything rejected or close to it. Add as `suggested` (`app/suggest.py`).
6. Stay read-only outside the database: no Slack posts, no GitHub changes, no sharing.
7. Only after the database is updated, run `python3 app/sweep.py mark slack`.
8. Finish with a 3–6 line summary of what changed, using refs (W1, W2…), or "No changes". If something new needs the owner, put it first.
