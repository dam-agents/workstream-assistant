// Today's focus and priority, set by hand. On the dashboard the owner drags rows between lanes; these are the
// one-click toggle on each row and the picker on a workstream's own page, where there is nothing to drag.
import type { Priority } from '../api/types';
import { api } from '../api/client';
import { useApp } from '../state/AppContext';
import { useAction } from '../state/useAction';
import { Button, Pill, cx } from './ui';

const PRIO: [Priority, string][] = [
  ['high', 'High'],
  ['normal', 'Normal'],
  ['low', 'Low'],
];

interface Ws {
  id: string;
  priority: Priority;
  priority_by: string;
  priority_why: string;
  focus: boolean;
}

export function FocusToggle({ ws }: { ws: Ws }) {
  const { live } = useApp();
  const { busy, run } = useAction();
  if (!live) return ws.focus ? <Pill tone="focus">Focus today</Pill> : <span />;
  return (
    <Button
      small
      variant={ws.focus ? 'focus' : 'default'}
      disabled={busy}
      title={ws.focus ? "Remove from today's focus" : 'Focus on this today (resets tomorrow)'}
      onClick={(e) => {
        e.stopPropagation(); // don't open the workstream behind the row
        void run(() => api.patchWorkstream(ws.id, { focus: !ws.focus }));
      }}
    >
      {ws.focus ? '★ Today' : '☆ Today'}
    </Button>
  );
}

/** Today toggle and a High / Normal / Low segmented picker, for a workstream's page. */
export function PriorityControl({ ws }: { ws: Ws }) {
  const { live } = useApp();
  const { busy, run } = useAction();
  const current = ws.priority ?? 'normal';
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <FocusToggle ws={ws} />
      <div role="radiogroup" aria-label="Priority" className="inline-flex overflow-hidden rounded-[7px] border border-line">
        {PRIO.map(([p, label]) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={p === current}
            disabled={!live || busy}
            onClick={() => p !== current && run(() => api.patchWorkstream(ws.id, { priority: p }))}
            className={cx(
              'cursor-pointer px-2 py-0.5 text-xs [&+&]:border-l [&+&]:border-line disabled:cursor-default',
              p === current ? 'bg-blue text-white' : 'bg-raise text-ink hover:bg-grey-soft',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {ws.priority_by === 'agent' && (
        <span className="text-[11px] text-muted" title={ws.priority_why || 'Set by the agent'}>
          set by agent
        </span>
      )}
    </div>
  );
}
