---
name: debrief
description: >-
  Talk through a meeting with the owner to agree how their working context changes:
  which workstreams move, what they now owe, what was decided, what got contradicted.
  Use when a session starts with "Debrief of the meeting …" (the owner clicked Debrief on the dashboard),
  when the owner says "debrief", "let's debrief <meeting>", or uploads a transcript, or tells you about a call that was not recorded.
  It is a conversation, not a silent update: propose the changes, discuss them, then write only what was agreed.
---

# Debrief

A meeting just happened. A transcript says what was said; only the owner knows what it **meant** for their work.
The debrief is a short conversation where you and the owner agree how the working context changes.

## How a debrief starts

- **From the dashboard.** The meeting sweep does not touch the workstreams. It only *proposes* the meeting: a row under **Debriefs** with a **Debrief** button. The owner clicks it when they have time, and that opens a new session whose first message names the meeting. This is that session.
- **From the owner**, in any chat: "debrief the call with Cleo", a transcript they upload, or a few words about a call nobody recorded. Create the row yourself so the dashboard stays true:
  `python3 app/sweep.py debrief-propose <id> "<title>" --source <source-id> [--url …] [--why …]`, then `python3 app/sweep.py debrief-start <id>`. `--source` is the meeting source it came from (`python3 app/sweep.py sources` lists them); it can be left out only when the owner has exactly one.

## What a debrief is not

- Not a meeting summary. The owner was there, or can read the transcript.
- Not a silent database update. Nothing about the meeting is written before the owner has seen what you propose.
- Not an interview. Never open with a list of questions.

## What you write alone, and what needs agreement

Nothing is written about this meeting before the debrief. The sweep only proposed it.

| Without asking (facts) | Only after the owner agrees (interpretation) |
|---|---|
| The `meeting` progress entry, on each workstream the owner confirms it touched, with the link (or file name) and who was in it | Status or status-note changes (red / amber / green) |
| | New asks, or follow-ups waiting on the owner |
| | Decisions ("we decided X") and anything that **contradicts** what the database says |
| | Closing an ask or follow-up, reassigning an owner, archiving a workstream |
| | New suggested workstreams |

If you are unsure which column a change belongs in, it belongs in the right one.

## Steps

### 1. Prepare, silently

- Run `python3 app/sweep.py debrief-show <id>`. It prints the meeting, which **source** it came from, why it was proposed, the workstreams it seems to touch (the sweep's guess, not a fact) and where the transcript is.
- Transcript available (any source kind: `mcp`, `folder`, `github`, or one the owner uploaded in chat): read it, in chunks if long. For an `mcp` source, use the tools of **that** source's server, named in its `tools`; another notetaker's tools don't know this recording id. Note `speakers unconfirmed` if the source says so.
- No transcript (a call nobody recorded, a hallway chat): ask the owner to say in a few sentences what happened, who was there and when, then continue from step 2. Treat it as the owner's word; the progress entry says so, and its `source` names it as the owner's account.
- Load the context the meeting touches: `python3 app/sweep.py state meetings`, the workstreams it names (`db.workstream`), their open asks and follow-ups (`python3 app/checks.py list`), and the rejected list (`db.rejected`). The owner's workstreams may also live in other sources: an ask from this meeting can close a follow-up first seen in any chat source.
- Skip what is not about the owner's workstreams ("Stay on topic" in AGENTS.md).
- Write nothing yet.

### 2. Open with the changes, not the recap

One message. Lead with what you think changes, ordered by how much it matters to the owner:

1. **Contradictions first.** "I had W2 as green, shipped Tuesday. In this call Cleo said it never reached prod."
2. **What you owe now.** Things the owner took on or were asked to do, each as a proposed ask.
3. **What moved.** Per workstream (use refs, W1, W2…): the proposed status change and the decision behind it.
4. **What closed.** Open asks and follow-ups the meeting resolved.
5. **Maybe new.** A candidate workstream, only if it is clearly a goal with an owner and the owner is in it.

Rules for this message:

- At most ~5 proposals, and at most 3 questions. If there are more, keep the top ones and say "N smaller things, I'll fold them in unless you object".
- Phrase each as something they can accept with one word: "Ask: send Cleo the rollout plan by Friday. OK?"
- Each proposal links to the exact moment or recording that supports it.
- Ask for what the transcript cannot tell you: who actually owns the follow-up, whether "I'll look into it" was a promise, whether a number was a commitment or a guess. Do not ask what you can read.
- State uncertainty plainly ("speakers unconfirmed", "this was Czech, I may have missed the tone").
- Same language the owner writes in.

### 3. Talk it through

Follow their lead.
They may accept, edit, drop, or tell you what you missed ("that wasn't a decision, it was Cleo thinking aloud").
Answer questions from the evidence; if the transcript does not say, say so instead of guessing.
When they correct you, take the correction at face value and adjust the other proposals it affects.
Stop when they have nothing more to change. Do not extend the conversation to feel thorough.

### 4. Apply only what was agreed

First the fact: add the `meeting` progress entry to each workstream the owner confirmed it touched. Then use the `app/db.py` helpers:

Name the meeting's source at the start of each `source` field ("Notetaker: weekly sync", "Box transcripts: 2026-10-20 QA call"), so the owner can tell which tool it came from.

| Agreed change | Helper |
|---|---|
| New ask for the owner | `add_ask`, with a link and a done check (`check_spec` and/or `done_when`) |
| Loop waiting on someone | `add_followup`, same rules |
| Closed loop | `resolve_ask` / `resolve_followup` |
| Status, TL;DR, key points | `update_workstream` (rewrite them as text, do not append) |
| Decision | `add_progress` with `type_="update"` or `"meeting"` and the link (there is no decisions helper) |
| Correction of earlier data | fix it, and say in the progress entry what was wrong |
| New workstream | `app/suggest.py`, as `suggested` |

Then `python3 app/checks.py list` to confirm each new done check reads correctly.
A check that errors never closes.

### 5. Close the loop

Finish with 2–4 lines: what you changed (by ref), what you left out on purpose, and anything still open that you will watch for.

Then close the debrief on the dashboard:

- `python3 app/sweep.py debrief-done <id> "<one line: what changed>"` when you applied something, or nothing needed to change.
- `python3 app/sweep.py debrief-dismiss <id> "<reason>"` when the owner says it isn't worth it.
- If the owner leaves mid-way, change nothing interpretive and leave it **started**. It stays on the dashboard, so they can come back with **Debrief again**.

## Boundaries

Read-only outside the database, as everywhere else: no Slack posts, no GitHub changes, no sharing, no edits in the meeting tool.
If the debrief suggests the owner should message someone, offer the draft in chat. Do not send it.
