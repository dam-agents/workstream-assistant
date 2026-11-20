// Everything that isn't one workstream, behind the bar above the pane: Debriefs, loose Follow-ups, Coming up and
// Suggested workstreams.
import { useState } from 'react';
import { api } from '../../api/client';
import { canPrompt, conversationKey, sendPrompt } from '../../api/platform';
import type { Debrief, Suggestion, Summary } from '../../api/types';
import { BackLink, Pane } from '../../components/Pane';
import { DeadlineRow, FollowupTodo } from '../../components/Rows';
import { Icon, type IconName } from '../../components/icons';
import { Button, Card, EmptyState, ExtLink, Rows, StatusPill, Tile, WsChip, cx } from '../../components/ui';
import type React from 'react';
import { ago, daysLeft, fmtDay, plural } from '../../lib/format';
import { refsIn } from '../../lib/workstreams';
import { useApp, type InboxTab } from '../../state/AppContext';
import { SENT_TO_SESSION, useAction } from '../../state/useAction';

/** The workstreams a ref list names, as chips that open them. */
function Touches({ s, refs }: { s: Summary; refs: number[] }) {
  const { navigate } = useApp();
  const known = refs.map((r) => s.workstreams.find((w) => w.ref === r)).filter((w) => !!w);
  return (
    <>
      {known.map((w) => (
        <WsChip key={w.id} ref_={w.ref} name={w.name} onClick={() => navigate({ view: 'ws', id: w.id })} />
      ))}
    </>
  );
}

/** Start (or continue) a debrief in a session of its own. */
export function useStartDebrief(d: { id: number }) {
  const { notify } = useApp();
  const { busy, run } = useAction();
  const [sent, setSent] = useState(false);
  const start = () => {
    if (!canPrompt()) return notify('warn', 'The Debrief button works only on the latest version of this page.');
    void run(
      async () => {
        const started = await api.startDebrief(d.id);
        // Each meeting gets a Session of its own; "Debrief again" continues it.
        sendPrompt(started.prompt, { conversation: conversationKey('debrief', d.id) });
        notify('ok', `Debrief: ${SENT_TO_SESSION}`);
        setSent(true);
        window.setTimeout(() => setSent(false), 3000);
      },
      { reloadAfter: false, failure: "Couldn't start the debrief" },
    );
  };
  return { busy, sent, start };
}

export function DebriefButton({ d }: { d: Debrief }) {
  const { live } = useApp();
  const { busy, sent, start } = useStartDebrief(d);
  if (sent)
    return (
      <Button variant="sent" disabled>
        <Icon name="check" width={2.4} className="size-[15px]" />
        Sent
      </Button>
    );
  return (
    <Button variant="primary" disabled={!live || busy} onClick={start}>
      {d.state === 'started' ? 'Debrief again' : 'Debrief'}
    </Button>
  );
}

function DebriefCard({ s, d, i }: { s: Summary; d: Debrief; i: number }) {
  const { live } = useApp();
  const { busy, run } = useAction();
  const [out, setOut] = useState(false);
  const dismiss = () => {
    setOut(true);
    window.setTimeout(() => void run(() => api.dismissDebrief(d.id)).then((ok) => !ok && setOut(false)), 280);
  };
  return (
    <li
      style={{ '--i': i } as React.CSSProperties}
      className={cx('rise grid list-none gap-2 rounded-2xl bg-raise px-[18px] py-4 shadow-card transition-[opacity,translate] duration-300 ease-ios', out && 'translate-x-10 opacity-0')}
    >
      <span className="text-xs font-medium text-faint">
        {d.meeting_ts && `${fmtDay(d.meeting_ts)} · `}
        {d.source_name || 'Meeting notes'}
        {d.state === 'started' && ` · started ${ago(d.started_at)}`}
      </span>
      <h3 className="m-0 text-[15.5px] leading-[1.3] font-semibold tracking-[-0.012em]">
        {d.url ? (
          <ExtLink href={d.url} className="text-ink">
            {d.title}
          </ExtLink>
        ) : (
          d.title
        )}
      </h3>
      {d.why && <p className="m-0 max-w-[72ch] text-sm leading-normal text-muted">{d.why}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Touches s={s} refs={refsIn(d.workstreams)} />
        {!d.workstreams && <span className="text-xs text-faint">Workstreams not matched</span>}
        <span className="ml-auto flex items-center gap-4">
          <Button disabled={!live || busy} onClick={dismiss}>
            Dismiss
          </Button>
          <DebriefButton d={d} />
        </span>
      </div>
    </li>
  );
}

function SuggestionCard({ w, i }: { w: Suggestion; i: number }) {
  const { live, navigate } = useApp();
  const { busy, run } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const reject = () => run(() => api.reject(w.id, reason));
  return (
    <li style={{ '--i': i } as React.CSSProperties} className="rise grid list-none gap-2 rounded-2xl bg-raise px-[18px] py-4 shadow-card">
      <div className="flex items-center gap-3">
        <Tile ref_={w.ref} />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-[15.5px] font-semibold tracking-[-0.012em]">{w.name}</h3>
          <span className="text-xs text-muted">Owner: {w.owner}</span>
        </div>
        <StatusPill status={w.status} />
      </div>
      <p className="m-0 max-w-[72ch] text-sm leading-normal text-muted">{w.tldr || w.goal}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {w.asks_open > 0 && <span className="text-xs font-semibold text-blue">{plural(w.asks_open, 'thing')} would need you</span>}
        <span className="ml-auto flex items-center gap-4">
          <Button onClick={() => navigate({ view: 'ws', id: w.id })}>Preview</Button>
          <Button disabled={!live || busy} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          <Button variant="primary" disabled={!live || busy} onClick={() => run(() => api.approve(w.id))}>
            Approve
          </Button>
        </span>
      </div>
      {rejecting && (
        // No <form>: the artifact frame blocks submits. Enter is handled by hand.
        <div className="flex gap-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.preventDefault(), void reject());
              if (e.key === 'Escape') setRejecting(false);
            }}
            placeholder="Why not? (optional, helps the agent avoid similar suggestions)"
            className="min-w-0 flex-1 rounded-lg border border-line-strong bg-raise px-2.5 py-1 text-[13px] text-ink"
          />
          <Button variant="danger" disabled={busy} onClick={reject}>
            Reject
          </Button>
          <Button onClick={() => setRejecting(false)}>Cancel</Button>
        </div>
      )}
    </li>
  );
}


export const TABS: { key: InboxTab; label: string; icon: IconName; count: (s: Summary) => number; urgent: (s: Summary) => boolean }[] = [
  { key: 'debriefs', label: 'Debriefs', icon: 'tray', count: (s) => s.debriefs.length, urgent: () => false },
  { key: 'followups', label: 'Follow-ups', icon: 'loop', count: (s) => s.followups.length, urgent: (s) => s.followups.some((f) => f.waiting_on === s.me) },
  { key: 'coming', label: 'Coming up', icon: 'calendar', count: (s) => s.deadlines.length, urgent: (s) => s.deadlines.some((d) => daysLeft(d.due) < 0) },
  { key: 'suggested', label: 'Suggested', icon: 'bulb', count: (s) => s.suggested.length, urgent: () => false },
];

/** A list's title and a line saying what it is. */
function ListHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="rise mb-4">
      <h2 className="m-0 font-display text-[clamp(22px,3.6cqi,28px)] leading-[1.14] font-bold tracking-[-0.026em]">{title}</h2>
      <p className="m-0 mt-1 text-[13px] text-muted">{sub}</p>
    </header>
  );
}

/** One of the lists behind the bar above the pane: everything that isn't one workstream. */
export function InboxPane({ s, tab }: { s: Summary; tab: InboxTab }) {
  if (tab === 'debriefs')
    return (
      <Pane>
        <BackLink />
        <ListHeader title="Debriefs" sub={s.debriefs.length ? `${plural(s.debriefs.length, 'meeting')} to talk through. Debrief starts a session about it.` : 'Nothing left to talk through.'} />
        {s.debriefs.length ? (
          <ul className="m-0 grid gap-3 p-0">
            {s.debriefs.map((d, j) => (
              <DebriefCard key={d.id} s={s} d={d} i={j + 1} />
            ))}
          </ul>
        ) : (
          <EmptyState title="All caught up">New meetings show up here after the agent reads your notes.</EmptyState>
        )}
      </Pane>
    );
  if (tab === 'coming') {
    const overdue = s.deadlines.filter((d) => daysLeft(d.due) < 0).length;
    return (
      <Pane>
        <BackLink />
        <ListHeader title="Coming up" sub={`${overdue ? `${overdue} overdue, then h` : 'H'}ard deadlines in the next 14 days and targets in the next 7.`} />
        {s.deadlines.length ? (
          <Card i={1}>
            <Rows>
              {s.deadlines.map((d) => (
                <DeadlineRow key={d.id} d={d} withWs />
              ))}
            </Rows>
          </Card>
        ) : (
          <EmptyState title="Nothing due soon" />
        )}
      </Pane>
    );
  }
  if (tab === 'followups') {
    const mine = s.followups.filter((f) => f.waiting_on === s.me);
    const others = s.followups.filter((f) => f.waiting_on !== s.me);
    return (
      <Pane>
        <BackLink />
        <ListHeader title="Follow-ups" sub="Open loops not tied to a workstream. Ones that belong to a workstream are on its page." />
        {s.followups.length ? (
          <div className="grid gap-4">
            {mine.length > 0 && (
              <Card i={1} title="Waiting on you" sub={mine.length}>
                <Rows>
                  {mine.map((f) => (
                    <FollowupTodo key={f.id} f={f} />
                  ))}
                </Rows>
              </Card>
            )}
            {others.length > 0 && (
              <Card i={2} title="Waiting on others" sub={others.length}>
                <Rows>
                  {others.map((f) => (
                    <FollowupTodo key={f.id} f={f} />
                  ))}
                </Rows>
              </Card>
            )}
          </div>
        ) : (
          <EmptyState title="No loose follow-ups" />
        )}
      </Pane>
    );
  }
  return (
    <Pane>
      <BackLink />
      <ListHeader title="Suggested workstreams" sub={s.suggested.length ? `${plural(s.suggested.length, 'workstream')} found in your sources, waiting for your approval.` : 'Nothing waiting for approval.'} />
      {s.suggested.length ? (
        <ul className="m-0 grid gap-3 p-0">
          {s.suggested.map((w, j) => (
            <SuggestionCard key={w.id} w={w} i={j + 1} />
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing to approve" />
      )}
    </Pane>
  );
}

/** The bar above the pane: a count per list, always in the same place, whichever workstream is open. */
export function InboxBar({ s, active, inline }: { s: Summary | null; active: InboxTab | null; inline?: boolean }) {
  const { navigate } = useApp();
  if (!s) return null;
  const shown = TABS.filter((t) => t.count(s) > 0 || t.key === active);
  return (
    <nav
      aria-label="Inbox"
      className={cx(!inline && 'sticky top-0 z-20 border-b border-line bg-[color-mix(in_srgb,var(--wsa-bg)_82%,transparent)] backdrop-blur-xl backdrop-saturate-150')}
    >
      <div className={cx('flex flex-wrap items-center gap-1.5', inline ? 'mt-2.5' : 'mx-auto max-w-[1040px] px-[clamp(12px,4cqi,32px)] py-2')}>
        {shown.length === 0 && <span className="px-1 py-1 text-[13px] text-muted">All caught up: no debriefs, loose follow-ups, deadlines or suggestions.</span>}
        {shown.map((t) => {
          const n = t.count(s);
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => navigate({ view: 'inbox', tab: t.key })}
              className={cx(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 py-1 pr-2 pl-2.5 text-[13px] font-medium transition-colors',
                on ? 'bg-raise text-ink shadow-card' : 'bg-transparent text-muted hover:bg-fill2 hover:text-ink',
              )}
            >
              <Icon name={t.icon} width={1.9} className="size-[15px]" />
              {t.label}
              <span
                className={cx(
                  'grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                  t.urgent(s) ? 'bg-blue text-white' : 'bg-fill text-muted',
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
