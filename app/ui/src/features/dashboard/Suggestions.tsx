// Workstreams the agent suggested, waiting for the owner to approve or reject them.
import { useState } from 'react';
import { api } from '../../api/client';
import type { Suggestion } from '../../api/types';
import { Button, NeedsPill, RefTag, SectionTitle, StatusPill } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { useAction } from '../../state/useAction';

function SuggestionRow({ s }: { s: Suggestion }) {
  const { live, navigate } = useApp();
  const { busy, run } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const reject = () => run(() => api.reject(s.id, reason));

  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 bg-amber-soft px-4 py-3.5 max-sm:grid-cols-1">
      <div>
        <div className="text-[15px] font-semibold">
          <RefTag ref_={s.ref} />
          {s.name} <NeedsPill n={s.asks_open} /> <StatusPill status={s.status} />
        </div>
        <div className="mt-0.5 line-clamp-2 text-[13px] text-muted">{s.tldr || s.goal}</div>
        <div className="mt-1 text-[12.5px] text-muted">Owner: {s.owner}</div>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate({ view: 'ws', id: s.id });
          }}
        >
          Preview
        </a>
        <Button variant="primary" disabled={!live || busy} onClick={() => run(() => api.approve(s.id))}>
          Approve
        </Button>
        <Button disabled={!live || busy} onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </div>
      {rejecting && (
        // No <form>: the artifact frame blocks submits. Enter is handled by hand.
        <div className="col-span-full flex gap-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void reject())}
            placeholder="Why not? (optional, helps the agent avoid similar suggestions)"
            className="flex-1 rounded-md border border-line bg-raise px-2 py-[5px] font-[inherit] text-[13px] text-ink"
          />
          <Button variant="danger" disabled={busy} onClick={reject}>
            Reject
          </Button>
          <Button onClick={() => setRejecting(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

export function Suggestions({ suggested }: { suggested: Suggestion[] }) {
  if (!suggested.length) return null;
  return (
    <>
      <SectionTitle count={`${suggested.length} waiting for your approval`}>Suggested workstreams</SectionTitle>
      <div className="overflow-hidden rounded-[10px] border border-dashed border-amber [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-line">
        {suggested.map((s) => (
          <SuggestionRow key={s.id} s={s} />
        ))}
      </div>
    </>
  );
}
