# Procedure: meeting sweep

Run by the schedule **Workstream Assistant: meeting sweep**. The precheck output (from `app/sweep.py state meetings`) lists the meeting source, the meetings already processed, the last sweep time and the rejected workstreams. All paths are relative to `/home/agent/work`.

1. If the API server is reported DOWN, run `python3 app/sweep.py ensure-server`.
2. Find new meetings with the meeting MCP server's search tool (`meetings.source` in `config.json`). Run several searches: one per approved and suggested workstream topic (read their names from the database), plus general ones such as "action items", "next steps", the owner's name, "release". Collect the recording ids dated after the last sweep that are **not** in the processed list.
3. For each new meeting, fetch it. Long transcripts are saved to a file, so read them in chunks; they may not be in English. Skip content that isn't about the owner's workstreams. For what's left:
   - add progress: type `meeting`, the meeting's own date and time, `url` = `meetings.url_template` with the recording id, and a one-line summary that names who was in it. If the speakers aren't confirmed, add "speakers unconfirmed".
   - add asks for things the owner took on, promised or was asked to do, and follow-ups for quick open loops. **Give each one its link and a done check** (`check_spec` and/or `done_when`).
   - rewrite tldr, key_points and status of the workstreams it affects
   - if the meeting contradicts something already in the database, correct it and say so in the summary
4. Record every meeting you looked at, including irrelevant ones: `python3 app/sweep.py seen <recording_id> "<date + short title>" <1 if it changed a workstream, else 0>`.
5. New candidate workstreams: only if it's clearly a goal with an owner and the owner of this agent is involved. Never anything rejected or close to it. Add as `suggested`.
6. Stay read-only outside the database: no Slack posts, no GitHub changes, no sharing, no changes in the meeting tool.
7. When done, run `python3 app/sweep.py mark meetings`.
8. Finish with a 3–6 line summary: which meetings were processed and what changed, or "No new meetings".
