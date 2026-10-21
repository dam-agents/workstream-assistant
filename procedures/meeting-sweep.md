# Procedure: meeting sweep

Run by the schedule **Workstream Assistant: meeting sweep**, and on demand when the owner hands me transcripts. The precheck output (from `app/sweep.py state meetings`) lists where the transcripts come from, any new transcript files, the meetings already processed, the last sweep time and the rejected workstreams. All paths are relative to `/home/agent/work`.

Meeting transcripts are optional. `meetings.kind` in `config.json` says how they reach me, and `meetings.location` says where:

| `kind` | `location` | Finding new meetings | Recording id |
|---|---|---|---|
| `mcp` | the MCP server's name | Use its search tool: one search per approved and suggested workstream topic (read their names from the database), plus general ones such as "action items", "next steps", the owner's name, "release". Keep meetings dated after the last sweep. | the server's recording id |
| `folder` | a mounted folder path (e.g. a Box mount) | The precheck lists the new files. | the file path relative to the folder |
| `github` | `owner/repo/path` | `gh api repos/<owner>/<repo>/commits?path=<path>&since=<last sweep>`, then the files those commits touched. | the file path in the repo |
| `upload` | (empty) | Nothing to sweep: the schedule skips itself. Process the transcripts when the owner uploads them in chat. | the file name |
| empty | | No transcripts: the schedule skips itself. | |

Whatever the kind, the steps are the same:

1. If the API server is reported DOWN, run `python3 app/sweep.py ensure-server`. If the precheck says the transcript folder isn't found, tell the owner it may be unmounted, and stop.
2. Collect the new meetings (table above) that are **not** in the processed list.
3. Read each one. Long transcripts may be big, so read them in chunks; they may not be in English. Skip content that isn't about the owner's workstreams. For what's left:
   - add progress: type `meeting`, the meeting's own date and time, a one-line summary that names who was in it, and a `url`: `meetings.url_template` with the recording id when there is one, else the file's own link (the GitHub blob URL, the Box link if the owner gave one). For an upload with no link, put the file name in `source`. If the speakers aren't confirmed, add "speakers unconfirmed".
   - add asks for things the owner took on, promised or was asked to do, and follow-ups for quick open loops. **Give each one its link and a done check** (`check_spec` and/or `done_when`).
   - rewrite tldr, key_points and status of the workstreams it affects
   - if the meeting contradicts something already in the database, correct it and say so in the summary
4. Record every meeting you looked at, including irrelevant ones: `python3 app/sweep.py seen <recording_id> "<date + short title>" <1 if it changed a workstream, else 0>`.
5. New candidate workstreams: only if it's clearly a goal with an owner and the owner of this agent is involved. Never anything rejected or close to it. Add as `suggested`.
6. Stay read-only outside the database: no Slack posts, no GitHub changes, no sharing, no changes to the transcripts or where they live.
7. When done, run `python3 app/sweep.py mark meetings`.
8. Finish with a 3–6 line summary: which meetings were processed and what changed, or "No new meetings".
