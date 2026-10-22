# Procedure: Slack sweep (renamed)

This procedure is now [`chat-sweep.md`](chat-sweep.md), because the input context can hold **several chat sources** (two Slack workspaces, a Teams MCP server, …), not one Slack. Follow that file.

This stub stays for instances whose **Workstream Assistant: Slack sweep** schedule still names this path. If that's you, follow `chat-sweep.md` for this run, then recreate the schedule once, so its name, precheck and task match the kit:

- name: `Workstream Assistant: chat sweep`
- precheck: `python3 /home/agent/work/app/sweep.py ensure-server >&2; python3 /home/agent/work/app/sweep.py state chat`
- task: `Workstream Assistant: chat sweep. Read /home/agent/work/AGENTS.md, then follow /home/agent/work/procedures/chat-sweep.md exactly. The precheck output below is the input it refers to.`
- same rrule and timezone as the old one (`list_schedules` shows them), then delete the old schedule.

`python3 app/sweep.py state slack` keeps working as an alias for `state chat`, so the old precheck doesn't break before you get to it.
