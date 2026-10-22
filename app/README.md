# Workstreams app

The app behind `AGENTS.md`: the database, the API server and the interactive artifact. Read this when you change the app, restart the server or publish a new version. Paths are relative to the repository root (`/home/agent/work`).

## Files

| File | Role |
|---|---|
| `data/wsa.db` | SQLite, **the source of truth** (git-ignored, created on first use). Tables: `workstreams` (permanent `ref`, shown as `W<ref>`; `state` suggested/approved/rejected), `asks` (open while `done_at` is null), `followups` (`workstream_id` NULL = loose; `waiting_on`), `progress`, `items`, `notes` (decision / principle / later), `links`, `snapshots`, `meta` (per-source watermarks `last_sweep_<source id>`, and `channels`: watched channels per source), `seen_meetings` (keyed `(source, recording_id)`), `debriefs` (a meeting proposed for debrief, with the `source` it came from: `state` proposed/started/done/dismissed). |
| `config.json` | Instance settings (git-ignored), read by `config.py`, which also normalizes the `sources` list and reports what's wrong with it (`python3 app/config.py`). Shape: `config.example.json`. |
| `app/db.py` | Schema and helpers: `add_workstream`, `workstream`, `summary`, `update_workstream`, `decide`, `rejected`, `resolve_workstream`, `add_progress`, `add_ask`/`resolve_ask`, `add_followup`/`resolve_followup`, `add_item`/`update_item`, `propose_debrief`/`start_debrief`/`finish_debrief`/`dismiss_debrief`/`open_debriefs`, and the per-source bookkeeping `last_sweep`/`mark_sweep`, `channels`/`channel_add`/`channel_remove`, `mark_meeting_seen`/`seen_meeting_ids`. |
| `app/server.py` | JSON API on **`127.0.0.1:5555`** (`port` in config), the only port interactive artifacts can reach. |
| `app/app.template.html` | The UI. `app/build.py` embeds a data snapshot and writes `app/app.html`. |
| `app/checks.py` | Done checks for asks and follow-ups (`check_spec` JSON). `list`, `verify [--apply]`, `precheck`. |
| `app/sweep.py` | Sweep bookkeeping, all per source: `sources`, `state <type\|source-id>`, `mark`, `seen`, watched channels, `ensure-server`, and the `debrief-*` commands. |
| `app/suggest.py` | Adds suggested workstreams, with their first progress, asks and follow-ups, from a JSON file. |

`WSA_DB` and `WSA_CONFIG` override the database and config paths (useful for tests).

## Several input sources

The input context is a list: any number of chat and meeting sources, each an entry in `config.json`'s `sources` with its own `id`. Everything per-source is keyed by that id — the sweep watermark, the watched channels, the processed meetings and each debrief — so sources never share state and ids from one never collide with another's. One schedule still covers all sources of a type; it loops over them and marks each as it finishes.

A database written before this change is migrated on the next `db.connect()`: `seen_meetings` is rebuilt with a `source` column, `debriefs` gains one, the old `slack_channels` meta becomes `channels`, and the old `last_sweep_slack` / `last_sweep_meetings` watermarks are copied to the **first** source of each type (the one they referred to). Renaming a source's `id` in `config.json` starts that source's history over; nothing else changes.

**API:** `GET /api/health`, `GET /api/summary`, `GET|PATCH /api/workstreams/:id` (id or ref, e.g. `W3`), `POST /api/workstreams/:id/approve`, `POST /api/workstreams/:id/reject` (`{reason}`), `GET /api/rejected`, `POST /api/workstreams/:id/items`, `PATCH /api/items/:id`, `POST /api/workstreams/:id/progress`, `POST /api/workstreams/:id/asks` (`{text, asked_by, source, url}`), `POST /api/asks/:id/done`, `POST /api/followups` (`{text, workstream_id?, waiting_on, next_step, source, url}`), `POST /api/followups/:id/done`, `GET /api/debriefs` (each with its `source` and `source_name`), `POST /api/debriefs/:id/start` (marks it started and returns the debrief with a `prompt`, which the page sends into the open chat), `POST /api/debriefs/:id/dismiss` (`{reason}`).

## Publishing

The artifact is "Workstreams", interactive and private. Keep its id in memory.

- **A data change needs no republish.** The page reads the API live.
- **A template change needs a republish:** `python3 app/build.py`, then `create_artifact_upload_url`, PUT `app/app.html`, then `update_artifact` with the same id.
- **A Kit Update can change the template too**, and nothing republishes the artifact on its own. So the page knows which template it was built from: `build.py` stamps the template's hash into it, the page sends that hash with every request (`?page=`), and the server records it. `/api/summary` returns the hash of the template on disk as `app_version`. When they differ, the page shows an "out of date" banner, and `sweep.py ensure-server` and every sweep's precheck print `App page: STALE`. Rebuild and republish when you see it.

## Running it

- The server stops when the agent hibernates. `python3 app/sweep.py ensure-server` starts it; every schedule's precheck does too.
- When the server is down, the page shows its built-in snapshot and a Retry button. Rebuild and republish now and then so the snapshot isn't too old.

## Rules for the UI

- **No `<form>` and no submit.** The artifact frame is sandboxed without `allow-forms`, so submits are blocked silently. Use inputs and a button `onclick`, and handle Enter with `keydown`.
- No `alert`, `confirm` or `prompt`. They're blocked too. Confirm inline.
- `platform.request` only works in the docked preview beside the chat, on the latest version.
- Test UI changes in a sandboxed iframe (`sandbox="allow-scripts"`) with a stand-in for `platform.request` before publishing.
- Keep the dashboard minimal: no stat boxes, item tables or long context sections.
