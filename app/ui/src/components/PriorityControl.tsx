// Focus-today toggle and priority picker, on a dashboard row and on a workstream page.
import type { Priority } from '../api/types';
import { api } from '../api/client';
import { useApp } from '../state/AppContext';
import { useAction } from '../state/useAction';
import { Button, Pill } from './ui';

const PRIO: Record<Priority, string> = { high: 'High', normal: 'Normal', low: 'Low' };

interface Props {
  ws: { id: string; priority: Priority; priority_by: string; priority_why: string; focus: boolean };
}

export function PriorityControl({ ws }: Props) {
  const { live } = useApp();
  const { busy, run } = useAction();
  const priority = ws.priority ?? 'normal';

  if (!live)
    return (
      <div className="flex items-center gap-1.5">
        {ws.focus && <Pill tone="focus">Focus today</Pill>}
        {priority !== 'normal' && <Pill tone="grey">{PRIO[priority]}</Pill>}
      </div>
    );

  return (
    // Clicks here must not open the workstream behind the row.
    <div className="flex items-center gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      <Button
        small
        variant={ws.focus ? 'focus' : 'default'}
        disabled={busy}
        title={ws.focus ? "Remove from today's focus" : 'Focus on this today (resets tomorrow)'}
        onClick={() => run(() => api.patchWorkstream(ws.id, { focus: !ws.focus }))}
      >
        {ws.focus ? '★ Today' : '☆ Today'}
      </Button>
      <select
        aria-label="Priority"
        title="Priority"
        value={priority}
        disabled={busy}
        onChange={(e) => run(() => api.patchWorkstream(ws.id, { priority: e.target.value as Priority }))}
        className="rounded-md border border-line bg-raise px-1 py-0.5 font-[inherit] text-xs text-ink"
      >
        {Object.entries(PRIO).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      {ws.priority_by === 'agent' && (
        <span className="text-[11px] text-muted" title={ws.priority_why || 'Set by the agent'}>
          agent
        </span>
      )}
    </div>
  );
}
