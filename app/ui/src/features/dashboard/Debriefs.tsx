// Meetings the meeting sweep proposed for a debrief.
import { api } from '../../api/client';
import { canPrompt, sendPrompt } from '../../api/platform';
import type { Debrief } from '../../api/types';
import { Button, ExtLink, Pill, SectionTitle } from '../../components/ui';
import { ago, fmtDay, plural } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useAction } from '../../state/useAction';

function DebriefRow({ d }: { d: Debrief }) {
  const { live, notify } = useApp();
  const { busy, run } = useAction();

  const start = () => {
    if (!canPrompt()) return notify('warn', 'The Debrief button works only in the docked preview beside the chat.');
    void run(
      async () => {
        const started = await api.startDebrief(d.id);
        sendPrompt(started.prompt);
        notify('warn', 'Debrief sent to the chat. If nothing arrives, open a chat first (send any message), then click Debrief again.');
      },
      { reloadAfter: false, failure: "Couldn't start the debrief" },
    );
  };

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 bg-blue-soft px-4 py-3.5 max-sm:grid-cols-1">
      <div>
        <div className="text-[15px] font-semibold">
          {d.url ? <ExtLink href={d.url}>{d.title}</ExtLink> : d.title}{' '}
          {d.state === 'started' && <Pill tone="blue">Started {ago(d.started_at)}</Pill>}
        </div>
        {d.why && <div className="mt-0.5 line-clamp-2 text-[13px] text-muted">{d.why}</div>}
        <div className="mt-1 text-[12.5px] text-muted">
          {d.meeting_ts && `${fmtDay(d.meeting_ts)} · `}
          {d.source_name && `${d.source_name} · `}
          {d.workstreams ? `touches ${d.workstreams}` : 'workstreams not matched'}
        </div>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Button variant="primary" disabled={!live || busy} onClick={start}>
          {d.state === 'started' ? 'Debrief again' : 'Debrief'}
        </Button>
        <Button disabled={!live || busy} onClick={() => run(() => api.dismissDebrief(d.id))}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function Debriefs({ debriefs }: { debriefs: Debrief[] }) {
  if (!debriefs.length) return null;
  return (
    <>
      <SectionTitle count={`${plural(debriefs.length, 'meeting')} to talk through`}>Debriefs</SectionTitle>
      <div className="overflow-hidden rounded-[10px] border border-blue [&>*+*]:border-t [&>*+*]:border-line">
        {debriefs.map((d) => (
          <DebriefRow key={d.id} d={d} />
        ))}
      </div>
    </>
  );
}
