// The workstreams, stacked by priority: Focus today, High, Normal, then Low (collapsed).
import type { ReactNode } from 'react';
import type { WorkstreamSummary } from '../../api/types';
import { Empty, cx } from '../../components/ui';
import { groupByPriority, isUngrouped } from '../../lib/workstreams';
import { useApp } from '../../state/AppContext';
import { WorkstreamRow } from './WorkstreamRow';

function List({ items, className }: { items: WorkstreamSummary[]; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-[10px] border border-line [&>*+*]:border-t [&>*+*]:border-line', className)}>
      {items.map((w) => (
        <WorkstreamRow key={w.id} ws={w} />
      ))}
    </div>
  );
}

const HEAD = 'mb-1.5 flex items-baseline gap-2 text-xs font-bold tracking-[.06em] uppercase text-muted';

function Head({ title, count }: { title: string; count: ReactNode }) {
  return (
    <>
      <span>{title}</span>
      <span className="font-normal tracking-normal normal-case">{count}</span>
    </>
  );
}

export function PriorityStack({ workstreams }: { workstreams: WorkstreamSummary[] }) {
  const { lowOpen, setLowOpen } = useApp(); // Low starts collapsed, and stays as the owner left it
  const groups = groupByPriority(workstreams);

  if (!groups.length) return <Empty>No workstreams yet. Ask the agent to suggest some.</Empty>;
  if (isUngrouped(groups)) return <List items={groups[0].workstreams} className="mt-[18px]" />;

  return groups.map(({ key, title, workstreams: items }) => {
    if (key === 'low') {
      const needs = items.filter((w) => w.asks_open > 0).length;
      return (
        <details key={key} open={lowOpen} onToggle={(e) => setLowOpen(e.currentTarget.open)} className="group mt-[18px]">
          <summary className={cx(HEAD, 'cursor-pointer list-none')}>
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            <Head title={title} count={`${items.length}${needs ? ` · ${needs} need you` : ''}`} />
          </summary>
          <List items={items} className="opacity-75" />
        </details>
      );
    }
    const focus = key === 'focus';
    return (
      <section key={key} className="mt-[18px]">
        <div className={cx(HEAD, focus && 'text-focus')}>
          <Head title={title} count={items.length} />
        </div>
        <List items={items} className={cx(focus && 'border-focus')} />
      </section>
    );
  });
}
