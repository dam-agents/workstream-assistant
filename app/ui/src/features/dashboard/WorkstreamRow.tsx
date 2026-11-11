import type { HTMLAttributes } from 'react';
import type { WorkstreamSummary } from '../../api/types';
import { NextDue } from '../../components/Rows';
import { FocusToggle } from '../../components/PriorityControl';
import { NeedsPill, RefTag, StatusPill, cx } from '../../components/ui';
import { ago, plural } from '../../lib/format';
import { useApp } from '../../state/AppContext';

/** What the drag & drop gives a row: the element that picks it up, and its listeners. */
export interface DragHandle {
  ref?: (el: HTMLElement | null) => void;
  props: HTMLAttributes<HTMLElement>;
}

export function WorkstreamRow({ ws, handle }: { ws: WorkstreamSummary; handle?: DragHandle }) {
  const { navigate } = useApp();
  return (
    <div
      onClick={() => navigate({ view: 'ws', id: ws.id })}
      className={cx(
        'grid cursor-pointer items-center gap-4 bg-surface py-3.5 pr-4 hover:bg-raise max-sm:grid-cols-1 max-sm:gap-1.5',
        handle ? 'grid-cols-[20px_130px_1fr_auto_auto_auto] pl-2' : 'grid-cols-[130px_1fr_auto_auto_auto] pl-4',
        ws.asks_open > 0 && 'shadow-[inset_4px_0_0_var(--color-needs)]',
      )}
    >
      {handle && (
        <button
          type="button"
          ref={handle.ref}
          {...handle.props}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Drag ${ws.ref ? `W${ws.ref}` : ws.name} to reprioritise`}
          title="Drag to reprioritise (or focus, then use the arrow keys)"
          className="flex h-8 w-5 cursor-grab touch-none items-center justify-center rounded text-[15px] leading-none text-muted hover:bg-grey-soft hover:text-ink active:cursor-grabbing max-sm:hidden"
        >
          ⠿
        </button>
      )}
      <div className="flex flex-col items-start gap-1">
        <NeedsPill n={ws.asks_open} />
        <StatusPill status={ws.status} />
        <NextDue d={ws.next_deadline} />
      </div>
      <div>
        <div className="text-[15px] font-semibold">
          <RefTag ref_={ws.ref} />
          {ws.name}
          {ws.priority_by === 'agent' && (
            <span className="ml-2 align-[1px] text-[11px] font-normal text-muted" title={ws.priority_why || 'Priority set by the agent'}>
              priority by agent
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[13px] text-muted">{ws.status_note}</div>
      </div>
      <div className="text-[12.5px] whitespace-nowrap text-muted">
        {ws.owner} · {ago(ws.last_activity)}
        {ws.followups_open > 0 && ` · ${plural(ws.followups_open, 'follow-up')}`}
      </div>
      <FocusToggle ws={ws} />
      <span className="font-semibold whitespace-nowrap text-blue">Detail →</span>
    </div>
  );
}
