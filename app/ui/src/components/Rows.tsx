// Row components that appear on both the dashboard and a workstream page.
import type { Deadline, Followup, Prebrief } from '../api/types';
import { ago, daysLeft, dueWhen, fmtDay, fmtDue, fmtTime } from '../lib/format';
import { api } from '../api/client';
import { useApp } from '../state/AppContext';
import { useAction } from '../state/useAction';
import { Button, ItemText, Meta, Pill, RefTag, cx } from './ui';

export function FollowupRow({ f }: { f: Followup }) {
  const { me, live } = useApp();
  const { busy, run } = useAction();
  const mine = !!f.waiting_on && f.waiting_on === me;
  return (
    <div className="flex items-center gap-3 py-[9px]">
      <div className="flex-1">
        <div className={cx(mine && 'font-semibold')}>
          <ItemText text={f.text} url={f.url} />
        </div>
        <Meta>
          {f.waiting_on && <Pill tone={mine ? 'needs' : 'grey'}>{mine ? 'Waiting on you' : `Waiting on ${f.waiting_on}`}</Pill>}{' '}
          {f.next_step && `Next: ${f.next_step} · `}
          {f.source} · {ago(f.ts)}
        </Meta>
      </div>
      {live && (
        <Button disabled={busy} onClick={() => run(() => api.followupDone(f.id))}>
          Done
        </Button>
      )}
    </div>
  );
}

export function DeadlineRow({ d, withWs }: { d: Deadline; withWs?: boolean }) {
  const { navigate } = useApp();
  const [when, tone] = dueWhen(d.due);
  return (
    <div className="flex items-center gap-3 py-[9px] max-sm:flex-wrap">
      <div className="w-24 flex-none font-semibold tabular-nums max-sm:w-auto">{fmtDue(d.due)}</div>
      <div className="min-w-0 flex-1">
        <div>
          {withWs && d.ws_ref && (
            <RefTag ref_={d.ws_ref} title={d.ws_name} onClick={() => navigate({ view: 'ws', id: d.workstream_id })} />
          )}
          <ItemText text={d.text} url={d.url} />
        </div>
        <Meta>
          {d.firm ? 'Hard deadline' : 'Target'}
          {d.original_due !== d.due && ` · was ${fmtDue(d.original_due)}`}
          {d.source && ` · ${d.source}`}
        </Meta>
      </div>
      <Pill tone={tone}>{when}</Pill>
    </div>
  );
}

/** The next deadline as a short pill on a dashboard row. */
export function NextDue({ d }: { d: Deadline | null }) {
  if (!d) return null;
  const n = daysLeft(d.due);
  return <Pill tone={dueWhen(d.due)[1]}>{n < 0 ? 'Overdue' : n === 0 ? 'Due today' : `Due ${fmtDue(d.due)}`}</Pill>;
}

export function PrebriefRow({ p, onOpen }: { p: Prebrief; onOpen: () => void }) {
  const { live } = useApp();
  return (
    <div className="flex items-center gap-3 py-[9px]">
      <div className="flex-1">
        <div>{p.title}</div>
        <Meta>
          {p.meeting_ts && `${fmtDay(p.meeting_ts)} ${fmtTime(p.meeting_ts)} · `}
          {p.attendees && `with ${p.attendees} · `}
          {p.artifact_id ? 'ready' : <Pill tone="grey">Draft</Pill>}
        </Meta>
      </div>
      {live && <Button onClick={onOpen}>Open</Button>}
    </div>
  );
}
