# Procedure: meeting sweep

Run by the schedule **Workstream Assistant: meeting sweep**, and on demand when the owner hands me transcripts. The precheck output (from `app/sweep.py state meetings`) lists where the transcripts come from, any new transcript files, the meetings already processed, the last sweep time and the rejected workstreams. All paths are relative to `/home/agent/work`.

Meeting transcripts are optional. `meetings.kind` in `config.json` says how they reach me, and `meetings.location` says where:

| `kind` | `location` | Finding new meetings | Recording id |
|---|---|---|---|
| `mcp` | the MCP server's name | Use its search tool: one search per approved and suggested workstream topic (read their names from the database), plus general ones such as "action items", "next steps", the owner's name, "release". Keep meetings dated after the last sweep. | the server's recording id |
| `folder` | a mounted folder path (e.g. a Box mount) | The precheck lists the new files. | the file path relative to the folder |
| `github` | `owner/repo/path` | `gh api repos/<owner>/<repo>/commits?path=<path>&since=<last sweep>`, then the files those commits touched. | the file path in the repo |
| `upload` | (empty) | Nothing to sweep: the schedule skips itself. A transcript the owner uploads in chat needs no proposal: debrief it right there with the **debrief** skill. | the file name |
| empty | | No transcripts: the schedule skips itself. | |

Whatever the kind, the steps are the same:

1. If the API server is reported DOWN, run `python3 app/sweep.py ensure-server`. If the precheck says the transcript folder isn't found, tell the owner it may be unmounted, and stop.
2. Collect the new meetings (table above) that are **not** in the processed list.
3. Read each one, only enough to decide whether it matters. Long transcripts may be big, so read them in chunks; they may not be in English. A meeting matters when it touches the owner's workstreams (see "Stay on topic" in AGENTS.md).
4. **Propose a debrief for each meeting that matters. Change nothing else.** The owner talks it through later, in a session of its own (the **debrief** skill, `.claude/skills/debrief/SKILL.md`):
   `python3 app/sweep.py debrief-propose <recording_id> "<title>" --when <ISO time> --url <link> --why "<one factual line>" --ws "W1, W3"`
   - `--why` says what in the meeting touches the owner's work, as a fact ("Cleo said the v0.4.0 cut never reached staging"). No verdicts and no proposed changes: those belong in the debrief.
   - `--ws` lists the refs it seems to touch. It's a guess; say so by leaving it out when unsure.
   - `--url` is `meetings.url_template` with the recording id when there is one, else the file's own link (the GitHub blob URL, the Box link if the owner gave one). For an upload with no link, leave it out.
   - Add no progress, asks, follow-ups, status or TL;DR, and no new workstreams. The proposal appears on the dashboard under **Debriefs** with a **Debrief** button.
   - A meeting already on the dashboard (listed under "Debriefs still open") is not proposed again.
5. Record every meeting that did **not** matter, so it isn't read again: `python3 app/sweep.py seen <recording_id> "<date + short title>" 0`. (A proposal marks its meeting seen by itself.)
6. Stay read-only outside the database: no Slack posts, no GitHub changes, no sharing, no changes to the transcripts or where they live.
7. When done, run `python3 app/sweep.py mark meetings`.
8. Finish with a 2–4 line summary: the meetings proposed for debrief (title and why), the number skipped, or "No new meetings".
