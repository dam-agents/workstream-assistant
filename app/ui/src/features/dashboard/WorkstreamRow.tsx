import type { WorkstreamSummary } from '../../api/types';
import { NextDue } from '../../components/Rows';
import { PriorityControl } from '../../components/PriorityControl';
import { NeedsPill, RefTag, StatusPill, cx } from '../../components/ui';
import { ago, plural } from '../../lib/format';
import { useApp } from '../../state/AppContext';

export function WorkstreamRow({ ws }: { ws: WorkstreamSummary }) {
  const { navigate } = useApp();
  return (
    <div
      onClick={() => navigate({ view: 'ws', id: ws.id })}
      className={cx(
        'grid cursor-pointer grid-cols-[130px_1fr_auto_auto_auto] items-center gap-4 bg-surface px-4 py-3.5 hover:bg-raise max-sm:grid-cols-1 max-sm:gap-1.5',
        ws.asks_open > 0 && 'shadow-[inset_4px_0_0_var(--color-needs)]',
      )}
    >
      <div className="flex flex-col items-start gap-1">
        <NeedsPill n={ws.asks_open} />
        <StatusPill status={ws.status} />
        <NextDue d={ws.next_deadline} />
      </div>
      <div>
        <div className="text-[15px] font-semibold">
          <RefTag ref_={ws.ref} />
          {ws.name}
        </div>
        <div className="mt-0.5 text-[13px] text-muted">{ws.status_note}</div>
      </div>
      <div className="text-[12.5px] whitespace-nowrap text-muted">
        {ws.owner} · {ago(ws.last_activity)}
        {ws.followups_open > 0 && ` · ${plural(ws.followups_open, 'follow-up')}`}
      </div>
      <PriorityControl ws={ws} />
      <span className="font-semibold whitespace-nowrap text-blue">Detail →</span>
    </div>
  );
}
