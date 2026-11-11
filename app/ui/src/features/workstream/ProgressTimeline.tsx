// The evidence timeline, newest first, grouped by day.
import type { Outcome, ProgressEntry } from '../../api/types';
import { Empty, ExtLink, Pill } from '../../components/ui';
import { fmtDay, fmtTime, type Tone } from '../../lib/format';

const OUTCOME: Partial<Record<Outcome, [string, Tone]>> = {
  pass: ['Passed', 'green'],
  done: ['Done', 'green'],
  fail: ['Failed', 'red'],
  blocked: ['Blocked', 'red'],
  risk: ['Risk', 'amber'],
};
const TYPE: Record<string, string> = {
  pr: 'PR', ticket: 'Ticket', meeting: 'Meeting', message: 'Message', doc: 'Doc', release: 'Release', update: 'Update',
};

function byDay(progress: ProgressEntry[]): [string, ProgressEntry[]][] {
  const days = new Map<string, ProgressEntry[]>();
  for (const e of [...progress].reverse()) {
    const d = fmtDay(e.ts);
    days.set(d, [...(days.get(d) ?? []), e]);
  }
  return [...days];
}

export function ProgressTimeline({ progress }: { progress: ProgressEntry[] }) {
  return (
    <div className="ml-1.5 border-l-2 border-line pl-[18px]">
      {progress.length === 0 && <Empty>No progress recorded yet.</Empty>}
      {byDay(progress).map(([day, entries]) => (
        <div key={day}>
          <div className="relative mt-4 mb-1.5 font-semibold before:absolute before:top-1.5 before:-left-[25px] before:size-2.5 before:rounded-full before:border-2 before:border-muted before:bg-page">
            {day}
          </div>
          {entries.map((e) => {
            const outcome = OUTCOME[e.outcome];
            return (
              <div key={e.id} className="my-1.5 grid grid-cols-[46px_74px_1fr] items-start gap-2.5">
                <div className="pt-px text-[12.5px] text-muted tabular-nums">{fmtTime(e.ts)}</div>
                <div>{outcome ? <Pill tone={outcome[1]}>{outcome[0]}</Pill> : <span className="text-xs text-muted">{TYPE[e.type] ?? e.type}</span>}</div>
                <div>{e.url ? <ExtLink href={e.url}>{e.summary}</ExtLink> : e.summary}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
