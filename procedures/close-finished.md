# Procedure: close finished items

Run by the schedule **Workstream Assistant: close finished items**. It only starts when `app/checks.py precheck` finds at least one ask or follow-up whose done check passes. The precheck output lists those items. All paths are relative to `/home/agent/work`.

1. Make sure the API server is running: `python3 app/sweep.py ensure-server`.
2. Confirm each listed item is really done. Look at what the check found, for example that the release really has notes and isn't an empty draft. If one looks like a false positive, leave it open, say why, and fix its `check_spec` if the check itself is wrong.
3. Close the confirmed ones: `python3 app/checks.py verify --apply`, or one by one with `db.resolve_ask` / `db.resolve_followup`.
4. If closing an item changes where a workstream stands (the fix landed, so the next step is the release notes), update its tldr, key_points and status_note with `db.update_workstream`.
5. Stay read-only outside the database: no Slack posts, no GitHub changes.
6. Finish with one line per closed item.
