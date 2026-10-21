# Workstreams app

The app behind `AGENTS.md`: the database, the API server and the interactive artifact. Read this when you change the app, restart the server or publish a new version. Paths are relative to the repository root (`/home/agent/work`).

## Files

| File | Role |
|---|---|
| `data/wsa.db` | SQLite, **the source of truth** (git-ignored, created on first use). Tables: `workstreams` (permanent `ref`, shown as `W<ref>`; `state` suggested/approved/rejected), `asks` (open while `done_at` is null), `followups` (`workstream_id` NULL = loose; `waiting_on`), `progress`, `items`, `notes` (decision / principle / later), `links`, `snapshots`, `meta`, `seen_meetings`. |
| `config.json` | Instance settings (git-ignored), read by `config.py`. Shape: `config.example.json`. |
| `app/db.py` | Schema and helpers: `add_workstream`, `workstream`, `summary`, `update_workstream`, `decide`, `rejected`, `resolve_workstream`, `add_progress`, `add_ask`/`resolve_ask`, `add_followup`/`resolve_followup`, `add_item`/`update_item`. |
| `app/server.py` | JSON API on **`127.0.0.1:5555`** (`port` in config), the only port interactive artifacts can reach. |
| `app/app.template.html` | The UI. `app/build.py` embeds a data snapshot and writes `app/app.html`. |
| `app/checks.py` | Done checks for asks and follow-ups (`check_spec` JSON). `list`, `verify [--apply]`, `precheck`. |
| `app/sweep.py` | Sweep bookkeeping: watermarks, processed meetings, watched channels, `ensure-server`. |
| `app/suggest.py` | Adds suggested workstreams, with their first progress, asks and follow-ups, from a JSON file. |

`WSA_DB` and `WSA_CONFIG` override the database and config paths (useful for tests).

**API:** `GET /api/health`, `GET /api/summary`, `GET|PATCH /api/workstreams/:id` (id or ref, e.g. `W3`), `POST /api/workstreams/:id/approve`, `POST /api/workstreams/:id/reject` (`{reason}`), `GET /api/rejected`, `POST /api/workstreams/:id/items`, `PATCH /api/items/:id`, `POST /api/workstreams/:id/progress`, `POST /api/workstreams/:id/asks` (`{text, asked_by, source, url}`), `POST /api/asks/:id/done`, `POST /api/followups` (`{text, workstream_id?, waiting_on, next_step, source, url}`), `POST /api/followups/:id/done`.

## Publishing

The artifact is "Workstreams", interactive and private. Keep its id in memory.

- **A data change needs no republish.** The page reads the API live.
- **A template change needs a republish:** `python3 app/build.py`, then `create_artifact_upload_url`, PUT `app/app.html`, then `update_artifact` with the same id.

## Running it

- The server stops when the agent hibernates. `python3 app/sweep.py ensure-server` starts it; every schedule's precheck does too.
- When the server is down, the page shows its built-in snapshot and a Retry button. Rebuild and republish now and then so the snapshot isn't too old.

## Rules for the UI

- **No `<form>` and no submit.** The artifact frame is sandboxed without `allow-forms`, so submits are blocked silently. Use inputs and a button `onclick`, and handle Enter with `keydown`.
- No `alert`, `confirm` or `prompt`. They're blocked too. Confirm inline.
- `platform.request` only works in the docked preview beside the chat, on the latest version.
- Test UI changes in a sandboxed iframe (`sandbox="allow-scripts"`) with a stand-in for `platform.request` before publishing.
- Keep the dashboard minimal: no stat boxes, item tables or long context sections.
