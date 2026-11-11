// The dashboard: what needs the owner, what's coming up, the workstreams, loose follow-ups, suggestions.
import type { Summary } from '../../api/types';
import { DeadlineRow, FollowupRow } from '../../components/Rows';
import { RowList, SectionTitle } from '../../components/ui';
import { daysLeft, plural } from '../../lib/format';
import { Debriefs } from './Debriefs';
import { PriorityStack } from './PriorityStack';
import { Suggestions } from './Suggestions';

function NeedsLine({ s }: { s: Summary }) {
  const n = s.workstreams.reduce((n, w) => n + w.asks_open, 0) + s.followups.filter((f) => f.waiting_on === s.me).length;
  const across = s.workstreams.filter((w) => w.asks_open).length;
  if (!n) return null;
  return (
    <div className="mt-4 text-[14px] text-needs">
      <b>
        {plural(n, 'thing')} need{n === 1 ? 's' : ''} you
      </b>{' '}
      in {plural(across, 'workstream')}
    </div>
  );
}

function ComingUp({ deadlines }: { deadlines: Summary['deadlines'] }) {
  if (!deadlines.length) return null;
  // every overdue one, else the next 5
  const shown = deadlines.slice(0, Math.max(5, deadlines.filter((d) => daysLeft(d.due) < 0).length));
  return (
    <>
      <SectionTitle count={deadlines.length > shown.length ? `${shown.length} of ${deadlines.length}` : 'overdue and the next 14 days'}>
        Coming up
      </SectionTitle>
      <RowList>
        {shown.map((d) => (
          <DeadlineRow key={d.id} d={d} withWs />
        ))}
      </RowList>
    </>
  );
}

function LooseFollowups({ followups }: { followups: Summary['followups'] }) {
  return (
    <>
      <SectionTitle count={followups.length ? `${followups.length} not tied to a workstream` : 'none outside workstreams'}>
        Follow-ups
      </SectionTitle>
      {followups.length ? (
        <RowList>
          {followups.map((f) => (
            <FollowupRow key={f.id} f={f} />
          ))}
        </RowList>
      ) : (
        <div className="py-1 text-muted">
          Quick open loops you start on Slack or in meetings show up here. Ones that belong to a workstream are shown in that
          workstream.
        </div>
      )}
    </>
  );
}

export function Dashboard({ s }: { s: Summary }) {
  return (
    <>
      <NeedsLine s={s} />
      <ComingUp deadlines={s.deadlines ?? []} />
      <Debriefs debriefs={s.debriefs ?? []} />
      <PriorityStack workstreams={s.workstreams} />
      <LooseFollowups followups={s.followups ?? []} />
      <Suggestions suggested={s.suggested ?? []} />
    </>
  );
}
