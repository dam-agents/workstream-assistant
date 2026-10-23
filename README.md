# From conversation to execution, with AI

On Tuesday's call, the product team asks for one thing before their release on the 30th: your toolkit has to work with the Zurich team's new model. You open an issue and give it to Ben. Ben waits two days for access from Zurich, then gets the fix merged. On Friday the product team asks if it's ready. The issue is closed, but the fix was never released.

Every step left a trace, but only your memory connected them back to the product release. And you have a dozen chains like this running at once.

## How work actually moves

Supporting the new model wasn't a project of its own. It was one piece of something bigger: getting your toolkit into the product release on the 30th. That has a goal, an owner (you) and an end. Call it a **workstream**.

If all of it lived in GitHub issues, you'd be fine: open the board and you know where you stand. But most of a workstream never becomes a ticket. It's in Slack threads, in calls, in emails and in the other teams' own tools. The issue tracker shows only part of the picture, so finding out where things really stand means piecing it together from all of them.

![Slack threads and meetings pour into one workstream, but only part of it reaches GitHub, which is all you see](assets/conversation-to-execution.svg)

## Before and after every meeting

Meetings are where workstreams turn. Deadlines slip, work changes hands, and decisions are made out loud. They're also where context gets lost.

A good meeting needs a prebrief. Before the call, you go through everything relevant: what's open, who's waiting on whom, what was left unresolved last time. Then you decide what you want from it. Between back-to-back calls nobody has time for that, so most meetings spend their first ten minutes catching up.

It also needs a debrief. What does everything that was just said mean for the work? Someone has to open the issue, message the product team, email the partner. By then the next call has already started. The notetaker writes everything down, and nobody reads it.

## AI-native execution

Look at what all of this asks of you. Hold the whole context of every workstream in your head, and keep checking that every part of it still moves in the right direction. It's heavy, repetitive work, and it takes real judgment: you have to understand what a message means for a goal, not just that it was sent. Too mechanical for a person to do well every day, and too nuanced for a script. That's exactly the kind of work AI is good at.

Picture an agent that reads every message you're part of and has access to every meeting. It does the due diligence you'd otherwise do by hand: opens the issue, checks the commits, nudges Ben about the release. Then it does the part no tool does. It takes everything you'd have gathered across Slack, calls and GitHub and turns it into one coherent story per workstream.

That story answers the only question that matters on a busy Tuesday: is the next move on you, or on someone else? And when something stalls, it tells you before anyone has to ask.

It covers both sides of every meeting, too. Before the call, it writes your prebrief: one short page with what you want from the call, what to raise and what you might be asked. After it, it debriefs with you: what changed, what you now owe, and the issues, messages and emails that should follow. You say yes, and it does the work.
