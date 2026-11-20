// One workstream: the header, then what to talk through, the to-dos, deadlines, the summary and prebriefs beside
// the timeline; goal and decisions folded away at the bottom.
import { useState, type CSSProperties } from 'react';
import { api } from '../../api/client';
import { conversationKey } from '../../api/platform';
import type { Ask, Priority, Summary, Workstream } from '../../api/types';
import { BackLink, Pane, PaneHeader } from '../../components/Pane';
import { AskTodo, DeadlineRow, FollowupTodo, PrebriefRow } from '../../components/Rows';
import { Icon } from '../../components/icons';
import { Avatars, Button, Card, Empty, ExtLink, Linkified, Pill, Rows, Seg, StatusPill, Tile, cx } from '../../components/ui';
import { ago, fmtDay } from '../../lib/format';
import { accentOf, parseKeyPoints, parseRoles, refsIn, wsRef } from '../../lib/workstreams';
import { useApp } from '../../state/AppContext';
import { SENT_TO_SESSION, useAction, usePrompt } from '../../state/useAction';
import { DebriefButton } from '../panes/Inbox';
import { madeOf, ProgressTimeline } from './ProgressTimeline';

const SKILL = '/home/agent/work/.claude/skills/prebrief/SKILL.md';

/** The prompt "Work on it" sends: the ask with everything the agent needs to pick it up, and the owner's own words. */
export function askPrompt(ws: Workstream, a: Ask, extra: string): string {
  const lines = [
    `Let's work on this ask in ${wsRef(ws)} (${ws.name}), ask #${a.id}:`,
    `"${a.text}"`,
    `Asked by ${a.asked_by}${a.source ? ` · ${a.source}` : ''}${a.url ? ` · ${a.url}` : ''}.`,
  ];
  if (extra.trim()) lines.push('', extra.trim());
  lines.push('', `Read the workstream and the source first, then help me get it done. Don't post or share anything without my go-ahead. When it's done, resolve the ask (db.resolve_ask).`);
  return lines.join('\n');
}

/** The prompt behind "Ask agent": refresh this one workstream, in a session of its own. */
export const refreshPrompt = (ws: { ref: number | null; id: string } | null) =>
  `Refresh ${ws ? `workstream "${wsRef(ws)}"` : 'all workstreams'} in the Workstreams app: sweep the sources since the last update, add new progress, close finished asks and follow-ups, and tell me what changed.`;

function SuggestedBanner({ ws }: { ws: Workstream }) {
  const { live, navigate } = useApp();
  const { busy, run } = useAction();
  return (
    <div className="rise mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl bg-amber-soft px-4 py-3 text-[13.5px] text-amber">
      <span className="mr-auto font-medium">Suggested workstream, waiting for your approval.</span>
      <Button disabled={!live} onClick={() => navigate({ view: 'inbox', tab: 'suggested' })}>
        Reject…
      </Button>
      <Button variant="primary" disabled={!live || busy} onClick={() => run(() => api.approve(ws.id))}>
        Approve
      </Button>
    </div>
  );
}

function Actions({ ws }: { ws: Workstream }) {
  const { live } = useApp();
  const { busy, run } = useAction();
  const prompt = usePrompt();
  const current = ws.priority ?? 'normal';
  if (ws.state !== 'approved') return null;
  return (
    <>
      <Button
        variant={ws.focus ? 'star' : 'default'}
        aria-pressed={ws.focus}
        disabled={!live || busy}
        title={ws.focus ? "Remove from today's focus" : 'Focus on this today (resets tomorrow)'}
        onClick={() => run(() => api.patchWorkstream(ws.id, { focus: !ws.focus }))}
      >
        <span key={String(ws.focus)} className={cx(ws.focus ? 'text-star [&_svg]:fill-current animate-[wsa-star_.5s_var(--ease-spring)]' : 'text-blue')}>
          <Icon name="star" width={1.7} className="size-[15px]" />
        </span>
        {ws.focus ? 'In focus today' : 'Focus today'}
      </Button>
      <span title={ws.priority_by === 'agent' ? `Set by the agent${ws.priority_why ? `: ${ws.priority_why}` : ''}` : 'Priority'} className={cx(!live && 'pointer-events-none opacity-50')}>
        <Seg<Priority>
          label="Priority"
          value={current}
          onChange={(p) => p !== current && run(() => api.patchWorkstream(ws.id, { priority: p }))}
          options={[
            { value: 'high', label: 'High' },
            { value: 'normal', label: 'Normal' },
            { value: 'low', label: 'Low' },
          ]}
        />
      </span>
      <Button
        variant="primary"
        disabled={!live}
        title="Ask the agent to refresh this workstream, in a session of its own"
        onClick={() =>
          prompt(refreshPrompt(ws), `Refresh: ${SENT_TO_SESSION}`, {
            // A fresh Session for each refresh, so it doesn't land in the middle of whatever the chat is doing.
            conversation: conversationKey('refresh', Date.now(), ws.id),
          })
        }
      >
        <Icon name="spark" width={1.6} className="size-[15px]" />
        Ask agent
      </Button>
    </>
  );
}

function TalkThrough({ ws, s }: { ws: Workstream; s: Summary | null }) {
  const list = (s?.debriefs ?? []).filter((d) => ws.ref && refsIn(d.workstreams).includes(ws.ref));
  if (!list.length) return null;
  return (
    <Card i={1} title="To talk through" sub={list.length === 1 ? '1 debrief' : `${list.length} debriefs`}>
      <Rows>
        {list.map((d) => (
          <li key={d.id} className="flex list-none items-center gap-3 py-1.5">
            <div className="min-w-0 flex-1">
              <b className="block truncate text-sm font-semibold">{d.title.replace(/^\d{4}-\d\d-\d\d\s+/, '')}</b>
              <span className="text-xs text-muted">{d.meeting_ts ? fmtDay(d.meeting_ts) : d.source_name}</span>
            </div>
            <DebriefButton d={d} />
          </li>
        ))}
      </Rows>
    </Card>
  );
}

function AskItem({ ws, a }: { ws: Workstream; a: Ask }) {
  const prompt = usePrompt();
  const [working, setWorking] = useState(false);
  const [extra, setExtra] = useState('');
  const send = () => {
    if (prompt(askPrompt(ws, a, extra), undefined, { conversation: conversationKey('ask', a.id) })) {
      setWorking(false);
      setExtra('');
    }
  };
  return (
    <AskTodo
      a={a}
      working={working}
      onWork={() => setWorking(true)}
      below={
        working && (
          // No <form>: the artifact frame blocks submits. Cmd/Ctrl+Enter sends, Escape cancels.
          <div className="mt-2 ml-[34px] flex flex-col gap-2">
            <textarea
              autoFocus
              rows={3}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.preventDefault(), send());
                if (e.key === 'Escape') setWorking(false);
              }}
              placeholder="Extra context for the session (optional): what you want to do, what you already know…"
              className="w-full rounded-[10px] border border-line-strong bg-raise px-3 py-2 font-[inherit] text-[13.5px] text-ink focus:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--wsa-blue)_35%,transparent)]"
            />
            <div className="flex items-center justify-end gap-4">
              <Button onClick={() => setWorking(false)}>Cancel</Button>
              <Button variant="primary" onClick={send}>
                Start a session
              </Button>
            </div>
          </div>
        )
      }
    />
  );
}

type TodoFilter = 'mine' | 'others' | 'all';

function Todos({ ws }: { ws: Workstream }) {
  const { me } = useApp();
  const mineF = ws.followups.filter((f) => f.waiting_on === me);
  const othersF = ws.followups.filter((f) => f.waiting_on !== me);
  const mineN = ws.asks.length + mineF.length;
  const [filter, setFilter] = useState<TodoFilter>(mineN || !othersF.length ? 'mine' : 'others');
  const showMine = filter !== 'others';
  const showOthers = filter !== 'mine';
  const empty = (showMine ? mineN : 0) + (showOthers ? othersF.length : 0) === 0;
  return (
    <Card
      i={2}
      label="To-dos"
      title="To-dos"
      action={
        <Seg<TodoFilter>
          label="Show to-dos for"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'mine', label: <>Needs you<span className="ml-[5px] font-medium text-muted tabular-nums">{mineN}</span></> },
            { value: 'others', label: <>Others<span className="ml-[5px] font-medium text-muted tabular-nums">{othersF.length}</span></> },
            { value: 'all', label: 'All' },
          ]}
        />
      }
    >
      <div key={filter} className="animate-[wsa-rise_.3s_var(--ease-ios)]">
        {empty ? (
          <Empty>{filter === 'mine' ? 'Nothing needs you here right now.' : filter === 'others' ? 'Not waiting on anyone.' : 'Nothing open.'}</Empty>
        ) : (
          <Rows>
            {showMine && ws.asks.map((a) => <AskItem key={`a${a.id}`} ws={ws} a={a} />)}
            {showMine && mineF.map((f) => <FollowupTodo key={`f${f.id}`} f={f} />)}
            {showOthers && othersF.map((f) => <FollowupTodo key={`f${f.id}`} f={f} />)}
          </Rows>
        )}
      </div>
    </Card>
  );
}

function SummaryCard({ ws }: { ws: Workstream }) {
  const points = parseKeyPoints(ws.key_points ?? '');
  return (
    <Card i={4} title="Summary" sub={madeOf(ws.progress) || undefined}>
      <p className="m-0 max-w-[68ch] text-[15.5px] leading-[1.55]">{ws.tldr || ws.status_note}</p>
      {points.length > 0 && (
        <ul className="m-0 mt-3 list-none p-0" aria-label="Key points">
          {points.map((p, i) => (
            <li
              key={i}
              className="relative py-[9px] pl-[18px] text-sm leading-[1.45] before:absolute before:top-4 before:left-0.5 before:size-1.5 before:rounded-full before:bg-(--accent) before:content-[''] [&+&]:border-t [&+&]:border-line"
            >
              {p.label && <strong className="font-semibold">{p.label}: </strong>}
              <Linkified text={p.text} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Prebriefs({ ws }: { ws: Workstream }) {
  const { live } = useApp();
  const prompt = usePrompt();
  const ref = wsRef(ws);
  return (
    <Card
      i={5}
      title="Prebriefs"
      action={
        <Button
          small
          disabled={!live}
          onClick={() =>
            prompt(
              `Prebrief a call for ${ref} (${ws.name}). Follow the prebrief skill, ${SKILL}: ask me which call if you can't tell, then draft it with me.`,
              undefined,
              { conversation: conversationKey('prebrief', ws.id, 'new', Date.now()) },
            )
          }
        >
          Prebrief a call
        </Button>
      }
    >
      {ws.prebriefs.length ? (
        <Rows>
          {ws.prebriefs.map((p) => (
            <PrebriefRow
              key={p.id}
              p={p}
              onOpen={() =>
                prompt(
                  `Continue prebrief #${p.id} for ${ref}. Follow the prebrief skill, ${SKILL}: \`python3 /home/agent/work/app/prebrief.py show ${p.id}\`, then link me the artifact and show me where it stands.`,
                  undefined,
                  { conversation: conversationKey('prebrief', p.id) },
                )
              }
            />
          ))}
        </Rows>
      ) : (
        <Empty>Prepare an upcoming call: what to raise, what to ask, what to watch for.</Empty>
      )}
    </Card>
  );
}

export function WorkstreamPage({ ws, s }: { ws: Workstream; s: Summary | null }) {
  const { me } = useApp();
  const decisions = ws.notes.filter((n) => n.kind === 'decision');
  const people = parseRoles(ws.roles).filter((p) => p.name !== ws.owner);
  return (
    <Pane>
      <div style={{ '--accent': accentOf(ws.ref) } as CSSProperties}>
        <BackLink />
        {ws.state === 'suggested' && <SuggestedBanner ws={ws} />}
        <PaneHeader
          tile={<Tile ref_={ws.ref} size={46} />}
          kicker={
            <>
              <StatusPill status={ws.status} />
              {ws.state === 'suggested' && <Pill tone="amber">Suggested</Pill>}
              <span>Updated {ago(ws.updated_at)}</span>
            </>
          }
          title={ws.name}
          sub={
            <>
              <span>Owner: {ws.owner === me ? 'You' : ws.owner}</span>
              <Avatars people={people} />
              {ws.epic_url && <ExtLink href={ws.epic_url}>{(ws.epic_label || 'Epic').split(' ')[0]} ↗</ExtLink>}
            </>
          }
          actions={<Actions ws={ws} />}
        />
        {ws.status_note && ws.status_note !== ws.tldr && <p className="rise -mt-2 mb-4 text-[13.5px] text-muted">{ws.status_note}</p>}
        <div className="grid grid-cols-1 items-start gap-4 @min-[760px]/main:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-4">
            <TalkThrough ws={ws} s={s} />
            <Todos ws={ws} />
            {ws.deadlines.length > 0 && (
              <Card i={3} title="Deadlines" sub={ws.deadlines.length}>
                <Rows>
                  {ws.deadlines.map((d) => (
                    <DeadlineRow key={d.id} d={d} />
                  ))}
                </Rows>
              </Card>
            )}
            <SummaryCard ws={ws} />
            <Prebriefs ws={ws} />
          </div>
          <div className="grid min-w-0 gap-4">
            <Card i={6} title="Timeline" sub={ws.progress.length === 1 ? '1 update' : `${ws.progress.length} updates`}>
              <ProgressTimeline progress={ws.progress} />
            </Card>
          </div>
        </div>
        <details className="rise mt-4 rounded-2xl bg-raise px-5 py-[14px] text-muted shadow-card [&[open]>summary_svg]:rotate-90">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[15px] font-semibold text-ink">
            <Icon name="chevron" width={2.2} className="size-3.5 transition-transform" />
            Goal and decisions
          </summary>
          <p className="mb-0 text-sm">
            <b className="text-ink">Goal:</b> {ws.goal}
          </p>
          {decisions.length > 0 && (
            <ul className="mb-0 list-disc pl-5 text-sm">
              {decisions.map((n) => (
                <li key={n.id} className="my-[3px]">
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </Pane>
  );
}
