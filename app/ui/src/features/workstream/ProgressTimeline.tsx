// The evidence timeline, newest first, grouped by day: a coloured dot per entry saying what kind it is.
import { useState, type CSSProperties } from 'react';
import type { Outcome, ProgressEntry } from '../../api/types';
import { Icon, type IconName } from '../../components/icons';
import { Button, Empty, ExtLink } from '../../components/ui';
import { dayLabel, fmtTime, shortDate } from '../../lib/format';
import { sourceKind } from '../../lib/links';

export const TYPE: Record<string, [label: string, icon: IconName, colour: string]> = {
  pr: ['PR', 'pr', 'var(--wsa-accent-4)'],
  ticket: ['Ticket', 'ticket', 'var(--wsa-accent-0)'],
  meeting: ['Meeting', 'meeting', 'var(--wsa-purple)'],
  message: ['Message', 'message', 'var(--wsa-faint)'],
  doc: ['Document', 'doc', 'var(--wsa-teal)'],
  release: ['Release', 'release', 'var(--wsa-green-dot)'],
  update: ['Update', 'update', 'var(--wsa-faint)'],
};

const OUTCOME: Partial<Record<Outcome, [label: string, icon: IconName | null, colour: string]>> = {
  pass: ['Passed', null, 'var(--wsa-green-dot)'],
  done: ['Done', 'check', 'var(--wsa-green-dot)'],
  fail: ['Failed', 'risk', 'var(--wsa-red-dot)'],
  blocked: ['Blocked', 'risk', 'var(--wsa-red-dot)'],
  risk: ['Risk', 'risk', 'var(--wsa-accent-1)'],
};

/** How an entry is drawn: its kind's icon, unless the outcome says more; the outcome's colour wins. */
export function kindOf(e: Pick<ProgressEntry, 'type' | 'outcome'>) {
  const [label, icon, colour] = TYPE[e.type] ?? [e.type, 'update', 'var(--wsa-faint)'];
  const o = OUTCOME[e.outcome];
  return { label, outcome: o?.[0], icon: o?.[1] ?? icon, colour: o?.[2] ?? colour };
}

function byDay(progress: ProgressEntry[]): [string, ProgressEntry[]][] {
  const days = new Map<string, ProgressEntry[]>();
  for (const e of [...progress].sort((a, b) => b.ts.localeCompare(a.ts))) {
    const d = e.ts.slice(0, 10);
    days.set(d, [...(days.get(d) ?? []), e]);
  }
  return [...days];
}

const FIRST = 30;

export function ProgressTimeline({ progress }: { progress: ProgressEntry[] }) {
  const [all, setAll] = useState(false);
  if (!progress.length) return <Empty>No progress recorded yet.</Empty>;
  const shown = all ? progress : [...progress].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, FIRST);
  return (
    <div>
      {byDay(shown).map(([day, entries], gi) => (
        <div key={day}>
          <h4 className={`mb-1 flex items-baseline justify-between gap-3 text-[13px] font-semibold ${gi ? 'mt-4' : 'mt-0'}`}>
            {dayLabel(entries[0].ts)}
            <span className="font-normal text-faint">{shortDate(entries[0].ts)}</span>
          </h4>
          <ol className="m-0 list-none p-0">
            {entries.map((e, i) => {
              const k = kindOf(e);
              const src = sourceKind(e.url);
              return (
                <li
                  key={e.id}
                  className={`relative grid grid-cols-[26px_minmax(0,1fr)] gap-3 pt-[7px] pb-[9px] ${i < entries.length - 1 ? "before:absolute before:top-[39px] before:-bottom-1 before:left-[12.5px] before:w-px before:bg-line-strong before:content-['']" : ''}`}
                >
                  <span style={{ '--kc': k.colour } as CSSProperties} className="grid size-[26px] place-items-center rounded-full bg-(--kc) text-white">
                    <Icon name={k.icon} width={2.2} className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <b className={`text-[14.5px] leading-[1.35] ${e.summary.length > 90 ? 'font-medium' : 'font-semibold'}`}>
                        {e.url ? (
                          <ExtLink href={e.url} className="text-ink hover:text-blue hover:no-underline">
                            {e.summary}
                          </ExtLink>
                        ) : (
                          e.summary
                        )}
                      </b>
                      <time className="text-xs whitespace-nowrap text-faint tabular-nums">{fmtTime(e.ts)}</time>
                    </div>
                    <span className="mt-[3px] block text-xs text-faint">
                      {k.label}
                      {k.outcome && ` · ${k.outcome}`}
                      {src && src !== k.label && ` · ${src}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {!all && progress.length > FIRST && (
        <Button small className="mt-2" onClick={() => setAll(true)}>
          Show {progress.length - FIRST} older
        </Button>
      )}
    </div>
  );
}

/** "From 4 messages, 2 meetings and 3 PRs": what the timeline is made of. */
export function madeOf(progress: ProgressEntry[]): string {
  const n = new Map<string, number>();
  for (const e of progress) n.set(e.type, (n.get(e.type) ?? 0) + 1);
  const PLURAL: Record<string, [string, string]> = {
    pr: ['PR', 'PRs'], ticket: ['ticket', 'tickets'], meeting: ['meeting', 'meetings'], message: ['message', 'messages'],
    doc: ['doc', 'docs'], release: ['release', 'releases'], update: ['update', 'updates'],
  };
  const parts = [...n].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${c} ${(PLURAL[t] ?? [t, t + 's'])[c === 1 ? 0 : 1]}`);
  if (!parts.length) return '';
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `From ${list}`;
}
