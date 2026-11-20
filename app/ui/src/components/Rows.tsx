// Rows that appear in more than one pane: to-dos (asks and follow-ups), deadlines, prebriefs.
import { useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Ask, Deadline, Followup, Prebrief } from '../api/types';
import { ago, daysLeft, dueWhen, fmtDay, fmtDue, fmtTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { useAction } from '../state/useAction';
import { Avatar, Button, Check, ItemText, Meta, Pill, WsChip, cx } from './ui';

/** One to-do: the round check, its text linked to the source, a line of detail, and what sits on the right. */
function TodoShell({ done, onDone, label, children, side, below }: { done: boolean; onDone: () => void; label: string; children: ReactNode; side?: ReactNode; below?: ReactNode }) {
  const { live } = useApp();
  return (
    <li className="list-none py-2.5">
      <div className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-3">
        <Check done={done} onClick={onDone} label={`Done: ${label}`} disabled={!live} />
        <div className={cx('min-w-0 text-[14.5px] leading-[1.38] transition-colors', done && 'text-faint [&_a]:text-faint')}>{children}</div>
        {side && <div className="flex items-center gap-2">{side}</div>}
      </div>
      {below}
    </li>
  );
}

/** Tick, let the check animate, then save; untick if saving fails. */
function useDone(save: () => Promise<unknown>) {
  const { busy, run } = useAction();
  const [done, setDone] = useState(false);
  const mark = () => {
    if (done || busy) return;
    setDone(true);
    window.setTimeout(() => void run(save).then((ok) => !ok && setDone(false)), 450);
  };
  return { done, mark };
}

export function AskTodo({ a, onWork, working, below }: { a: Ask; onWork?: () => void; working?: boolean; below?: ReactNode }) {
  const { live } = useApp();
  const { done, mark } = useDone(() => api.askDone(a.id));
  return (
    <TodoShell
      done={done}
      onDone={mark}
      label={a.text}
      below={below}
      side={
        live && onWork && !done ? (
          <Button small disabled={working} onClick={onWork} title="Start a session about this ask">
            Work on it
          </Button>
        ) : undefined
      }
    >
      <ItemText text={a.text} url={a.url} />
      <Meta>
        {a.asked_by}
        {a.source && ` · ${a.source}`} · {ago(a.ts)}
      </Meta>
    </TodoShell>
  );
}

export function FollowupTodo({ f, ws }: { f: Followup; ws?: { ref: number | null; name: string; onOpen: () => void } }) {
  const { me } = useApp();
  const { done, mark } = useDone(() => api.followupDone(f.id));
  const mine = !!f.waiting_on && f.waiting_on === me;
  return (
    <TodoShell done={done} onDone={mark} label={f.text} side={f.waiting_on && !mine ? <Avatar name={f.waiting_on} title={`Waiting on ${f.waiting_on}`} /> : undefined}>
      <ItemText text={f.text} url={f.url} />
      <Meta>
        {mine ? <span className="font-semibold text-blue">Waiting on you</span> : f.waiting_on ? `Waiting on ${f.waiting_on}` : 'Open'}
        {f.next_step && ` · Next: ${f.next_step}`}
        {f.source && ` · ${f.source}`} · {ago(f.ts)}
      </Meta>
      {ws && (
        <div className="mt-1.5">
          <WsChip ref_={ws.ref} name={ws.name} onClick={ws.onOpen} />
        </div>
      )}
    </TodoShell>
  );
}

export function DeadlineRow({ d, withWs }: { d: Deadline; withWs?: boolean }) {
  const { navigate } = useApp();
  const [when, tone] = dueWhen(d.due);
  const late = daysLeft(d.due) < 0;
  return (
    <li className="grid list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[14.5px] leading-[1.38]">
          <ItemText text={d.text} url={d.url} />
        </div>
        <Meta>
          <span className={cx('font-semibold tabular-nums', late ? 'text-red' : 'text-ink')}>{fmtDue(d.due)}</span>
          {' · '}
          {d.firm ? 'Hard deadline' : 'Target'}
          {d.original_due !== d.due && ` · was ${fmtDue(d.original_due)}`}
          {d.source && ` · ${d.source}`}
        </Meta>
        {withWs && d.ws_name && (
          <div className="mt-1.5">
            <WsChip ref_={d.ws_ref ?? null} name={d.ws_name} onClick={() => navigate({ view: 'ws', id: d.workstream_id })} />
          </div>
        )}
      </div>
      <Pill tone={tone} dot>
        {when}
      </Pill>
    </li>
  );
}

export function PrebriefRow({ p, onOpen }: { p: Prebrief; onOpen: () => void }) {
  const { live } = useApp();
  return (
    <li className="flex list-none items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <b className="block truncate text-sm font-semibold">{p.title}</b>
        <span className="text-xs text-muted">
          {p.meeting_ts && `${fmtDay(p.meeting_ts)} ${fmtTime(p.meeting_ts)} · `}
          {p.attendees && `with ${p.attendees} · `}
          {p.artifact_id ? 'ready' : 'draft'}
        </span>
      </div>
      {live && (
        <Button small onClick={onOpen}>
          Open
        </Button>
      )}
    </li>
  );
}
