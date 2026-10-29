---
name: prebrief
description: >-
  Prepare the owner for an upcoming call, together, and keep the result as an artifact in the workstream's prebrief folder,
  so the debrief can later compare what was planned with what happened.
  Use when the owner says "prebrief", "prep me for the call with …", "let's prepare for <meeting>",
  or clicks Prebrief on a workstream page in the app.
  It is an iteration, not a one-shot document: draft, discuss, revise, then publish only when the owner says it's ready.
---

# Prebrief

A call is coming up. The owner wants to walk in knowing what they want out of it.
The prebrief is a short iteration in chat that ends in one document: what the call is for, what to raise, what to ask, what to watch for.
It is published as a private artifact in the workstream's **prebrief folder**, and the debrief reads it next to the transcript.

## What a prebrief is not

- Not a status report. The owner can read the dashboard; pick only what matters for *this* call.
- Not a script. Bullets the owner can glance at during the call, not paragraphs.
- Not shared. The artifact stays private; sending it to attendees is the owner's call, and needs their explicit go-ahead.

## Steps

### 1. Pin down the call

From the owner's words, settle: which call (title), when, with whom, and which workstream it is mostly about (the folder it goes in), plus any others it touches.
Ask only what you can't infer; one short question at most. A call about none of the workstreams is fine (`-`).
Check that there is no open prebrief for it already: `python3 app/prebrief.py list`. If there is, continue that one (step 3) instead of starting over.

Then: `python3 app/prebrief.py new <W3|-> "<title>" --when <ISO> --with "<attendees>" [--also "W1"]`. It prints the id and the markdown file to write.

### 2. Gather, silently

- The workstreams it touches: `db.workstream(conn, "W3")` (TL;DR, key points, open asks and follow-ups, recent progress), and `python3 app/checks.py list` for the done checks.
- What's waiting on the attendees: follow-ups whose `waiting_on` is one of them, in any workstream.
- What the attendees want from the owner: open asks they raised.
- The last time these people met: search the meeting sources for the previous call with them (`debrief-show` of a recent debrief, or that source's search), and its prebrief in the archive, if any, for loops left open.
- Recent messages with them in the chat sources, only when the database looks thin or stale.
- Who is away around the call, when an availability source is configured: use the **who-is-away** skill for the attendees and anyone whose work the call depends on, around the call date. An attendee off the week after, or a reviewer out before a deadline, belongs under **Watch for**.
- Respect "Stay on topic" in AGENTS.md and the owner's memory notes about who must not see what.

### 3. Draft, then iterate

Write the draft to the markdown file `new` printed, and show it in chat. Use this shape, and drop any empty section:

```markdown
# Prebrief: <title>
<when> · with <attendees> · <W3 name> (also W1)

## Goal of the call
One or two lines: what the owner wants to leave with.

## Raise
- <topic>: <what to say or decide> ([evidence](link))

## Ask
- <person>: <question> ([why](link))

## They may ask you
- <likely question>: <short answer or what to check first>

## Watch for
- <risk or contradiction with what the database says>

## Open from last time
- <loop>: <state> ([link](link))
```

Rules:

- At most ~5 bullets per section; lead with what matters most.
- Every claim about progress links to its evidence, as everywhere (AGENTS.md, "Every item links to its source").
- Same language the owner writes in.
- Then iterate: the owner adds, cuts, reorders, corrects. Rewrite the file each time and show only what changed, unless they ask to see it all.
- Stop when the owner says it's ready. Don't extend it to feel thorough.

### 4. Publish to the workstream's folder

1. `python3 app/prebrief.py folder <W3|->`. If it says no folder yet, create it with `create_artifact_folder` under the name it prints, then `python3 app/prebrief.py folder-set <W3|-> <folder_id>`.
2. First publish: `create_artifact` with `type: markdown`, `visibility: private`, the file's content, `title: "Prebrief: <title> (<date>)"`, `folder_id` and `source_path` (the file, relative to `/home/agent/work`). Then `python3 app/prebrief.py published <id> <artifact_id> <folder_id>`.
3. A later revision: `update_artifact` on the same id with the new content (a new version; the link stays the same).
4. Give the owner the link as `[Prebrief: <title>](platform://artifacts/<artifact_id>)`.

Write nothing else: no asks, follow-ups, status or progress come out of a prebrief. A prebrief is a plan; the debrief records what happened.
If preparing uncovered something that needs the owner regardless of the call (an ask nobody had recorded), mention it and offer to add it; add it only if they agree.

## How it ends: in the debrief

The **debrief** skill reads the prebrief next to the transcript (`debrief-show` lists the matching prebrief) and opens with how the call went against it: goal met or not, what was raised, what was asked and answered, what is still open.
When the debrief is done, it archives the prebrief:

- `python3 app/prebrief.py link <id> <debrief_id>` (if not linked yet), then `python3 app/prebrief.py archive <id> "<one line: how the call went against the plan>"`.
- It prints the `update_artifact` call that moves the artifact to the **Prebriefs · Archive** folder. If the archive folder doesn't exist yet, `prebrief.py folder archive` says how to create it.

A call that never happened: archive the prebrief with that as the outcome, when the owner says so.
