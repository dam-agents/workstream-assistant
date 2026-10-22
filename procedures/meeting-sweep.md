# Procedure: meeting sweep

Run by the schedule **Workstream Assistant: meeting sweep**, and on demand when the owner hands me transcripts. It reads **every meeting source** in `config.json`: a notetaker's MCP server, a mounted folder, a folder in a repository, or several at once. The precheck output (from `app/sweep.py state meetings`) gives one block per source: where its transcripts come from, its own watermark, any new files, the meetings already processed there, and the debriefs already open. All paths are relative to `/home/agent/work`.

Meeting transcripts are optional: with no meeting source, the schedule skips itself. Each source's `kind` says how its transcripts reach me and its `location` says where:

| `kind` | `location` | Finding new meetings | Recording id |
|---|---|---|---|
| `mcp` | the MCP server's own name for its content (the server is in `tools`) | Use that server's search tool — its tools are prefixed with the `tools` name: one search per approved and suggested workstream topic (read their names from the database), plus general ones such as "action items", "next steps", the owner's name, "release". Keep meetings dated after that source's watermark. | the server's recording id |
| `folder` | a mounted folder path (e.g. a Box mount) | The precheck lists the new files. | the file path relative to the folder |
| `github` | `owner/repo/path` | `gh api repos/<owner>/<repo>/commits?path=<path>&since=<that source's watermark>`, then the files those commits touched. | the file path in the repo |
| `upload` | (empty) | Nothing to sweep. A transcript the owner uploads in chat needs no proposal: debrief it right there with the **debrief** skill. | the file name |

Whatever the kinds, the steps are the same:

1. If the API server is reported DOWN, run `python3 app/sweep.py ensure-server`. If the precheck reports a problem with a source (a transcript folder that isn't found, for example), tell the owner that source may be unmounted or misconfigured, skip it, and carry on with the others. Don't guess another path.
2. **Take the sources listed under "Sources to sweep in this run" one at a time**, and for each, collect the new meetings (table above) that are **not** in that source's processed list. Recording ids are only unique within a source, so always pass `--source <source-id>`; two notetakers may well both number a meeting `1`.
3. Read each one, only enough to decide whether it matters. Long transcripts may be big, so read them in chunks; they may not be in English. A meeting matters when it touches the owner's workstreams (see "Stay on topic" in AGENTS.md).
4. **Propose a debrief for each meeting that matters. Change nothing else.** The owner talks it through later, in a session of its own (the **debrief** skill, `.claude/skills/debrief/SKILL.md`):
   `python3 app/sweep.py debrief-propose <recording_id> "<title>" --source <source-id> --when <ISO time> --url <link> --why "<one factual line>" --ws "W1, W3"`
   - `--source` is the source the meeting came from. It's how the debrief later finds the transcript again, and the dashboard shows its name on the row.
   - `--why` says what in the meeting touches the owner's work, as a fact ("Cleo said the v0.4.0 cut never reached staging"). No verdicts and no proposed changes: those belong in the debrief.
   - `--ws` lists the refs it seems to touch. It's a guess; say so by leaving it out when unsure.
   - `--url` is that source's `url_template` with the recording id when it has one, else the file's own link (the GitHub blob URL, the Box link if the owner gave one). For an upload with no link, leave it out.
   - Add no progress, asks, follow-ups, status or TL;DR, and no new workstreams. The proposal appears on the dashboard under **Debriefs** with a **Debrief** button.
   - A meeting already on the dashboard (listed under "Debriefs still open" for that source) is not proposed again.
   - **The same meeting may appear in two sources** (a notetaker and a folder of exported transcripts). If a proposal for it is already open under another source, don't propose it twice: mark it seen in this source and say so in the summary.
5. Record every meeting that did **not** matter, so it isn't read again: `python3 app/sweep.py seen <recording_id> "<date + short title>" 0 --source <source-id>`. (A proposal marks its meeting seen by itself.)
6. Stay read-only outside the database: no messages posted in any source, no GitHub changes, no sharing, no changes to the transcripts or where they live.
7. **Mark each source as you finish it:** `python3 app/sweep.py mark <source-id>`. A source you skipped keeps its old watermark, so nothing is lost.
8. Finish with a 2–4 line summary: the meetings proposed for debrief (title, source and why), the number skipped, which sources you couldn't read, or "No new meetings".
