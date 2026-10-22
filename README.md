# Workstream Assistant

![Input context and execution context flow into the assistant, which joins them up into workstreams heading to their goals. You work with the assistant, and it acts in your execution context for you](assets/hero.svg)

Drive your workstreams to completion, or follow the ones you depend on, without forgetting what's on you or who you're waiting on.

## What a workstream is

As a knowledge worker you rarely work on one thing. You watch several streams of work at once, such as a product launch and a hiring round. Each of these is a **workstream**: one initiative with a goal, an owner, and often other people who own parts of it. It ends when the goal is reached, so "hire two designers by June" is a workstream, and "hiring" is too broad to be one.

Every workstream has two parts:

- **Input context** is where the work is talked about: messaging apps such as Slack or Teams, and meetings. This is where people ask for things, decide and make promises.
- **Execution context** is where the work gets done: the tool the team works in, such as a tracker, a shared document or a code repository. For software engineering that's usually GitHub.

## How Workstream Assistant helps

To know where a workstream stands, you read both parts and join them up in your head, for every workstream, every day. That's how an ask from a meeting slips, or a piece of work you were waiting on gets finished and nobody tells you.

Workstream Assistant is a [DAM](https://github.com/dam-agents/dam) Starter Kit for an agent that reads both for you and joins them up. When a new workstream comes up in a conversation, the agent suggests it to you. Approve it and the agent keeps track of it from then on. When something is blocked on you, you can hand it to the agent, which already has the whole context. It reads your execution context from GitHub.

**Your input context is a list, not one of each.** Work rarely happens in one place: your own company's Slack and a partner's, a Teams server, a notetaker for calls, a folder of exported transcripts. Connect as many as you have and the agent sweeps each on its own, remembering separately how far it has read in each, so nothing is missed because something else was read. Every item then says which source it came from, so "who asked me this, and where" has an answer.

The agent keeps track of:

- **Workstreams**: a high-level view of where each one stands toward its goal, with the details behind it one click away.
- **Asks**, shown as **Needs you**: what someone asked you to do, what you promised, and decisions or reviews waiting on you.
- **Follow-ups**: the quick loops you opened ("can you rebase it?", "let me know when it's done"), each with who has the next move.
- **Progress**: the evidence timeline of PRs, tickets, messages, meetings and releases.

It also gives you an app, a control centre for all of this. The app opens with "N things need you", then one row per workstream with its status, a one-line note and its last activity. Workstreams that need you come first. Open a workstream to see its asks, TL;DR, key points, follow-ups and timeline. You act from there too: mark asks and follow-ups done, and approve or reject the workstreams the agent suggests.

## What it does, and what it leaves to you

- **You decide what it tracks.** Every chat and meeting sweep looks for new workstreams that have a clear goal and an owner, and that you're involved in. They show up in the app as suggestions, and you approve or reject each one. Give a reason when you reject one ("not my area", "we already have an issue for that") and it won't suggest that workstream, or anything close to it, again.
- **It closes finished items itself.** Each ask and follow-up carries a done check: an issue closed, a PR merged, a tag that contains a fix, a release with notes. A script runs the checks every 20 minutes on weekdays and wakes the agent only when one passes, so idle runs cost no model calls. The agent confirms each item is really done before closing it.
- **Every entry links to its source.** Progress, asks and follow-ups link to the exact message, GitHub issue or PR, or meeting behind them, and name the workspace or tool it came from. When sources disagree, such as a release that "shipped" in chat but was never deployed, the agent corrects the record and tells you.
- **It can act for you.** When something is blocked on you, ask the agent to do it. It already knows the workstream, so it can draft what's needed, such as a reply on an issue or the release notes, and do the work in GitHub once you say so. Until you do, it only reads the sources you connect and writes to its own database.
