// One workstream: what needs the owner, TL;DR, deadlines, key points, follow-ups, prebriefs, progress.
import { api } from '../../api/client';
import { useState } from 'react';
import type { Ask, Workstream } from '../../api/types';
import { PriorityControl } from '../../components/PriorityControl';
import { DeadlineRow, FollowupRow, PrebriefRow } from '../../components/Rows';
import { Button, ExtLink, ItemText, Linkified, Meta, RefTag, RowList, SectionTitle, StatusPill } from '../../components/ui';
import { ago, plural } from '../../lib/format';
import { parseKeyPoints, wsRef } from '../../lib/workstreams';
import { useApp } from '../../state/AppContext';
import { useAction, usePrompt } from '../../state/useAction';
import { ProgressTimeline } from './ProgressTimeline';

const SKILL = '/home/agent/work/.claude/skills/prebrief/SKILL.md';

function SuggestedBanner({ ws }: { ws: Workstream }) {
  const { live, navigate } = useApp();
  const { busy, run } = useAction();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-lg bg-amber-soft px-3.5 py-2.5 text-[13px] text-amber">
      Suggested workstream, waiting for your approval.
      <Button variant="primary" disabled={!live || busy} onClick={() => run(() => api.approve(ws.id))}>
        Approve
      </Button>
      <Button disabled={!live} onClick={() => navigate({ view: 'dash' })}>
        Reject
      </Button>
    </div>
  );
}

/** The prompt "Work on it" sends: the ask with everything the agent needs to pick it up, and the owner's own words. */
export function askPrompt(ws: Workstream, a: Ask, extra: string): string {
  const lines = [
    `Let's work on this ask in ${wsRef(ws)} (${ws.name}), ask #${a.id}:`,
    `"${a.text}"`,
    `Asked by ${a.asked_by}${a.source ? ` · ${a.source}` : ''}${a.url ? ` · ${a.url}` : ''}.`,
  ];
  if (extra.trim()) lines.push('', extra.trim());
  lines.push('', `Read the workstream and the source first, then help me get it done. Don't post or share anything without my go-ahead. When it's done, resolve the ask (db.resolve_ask).`);
  return lines.join('\n');
}

function AskRow({ ws, a }: { ws: Workstream; a: Ask }) {
  const { live } = useApp();
  const { busy, run } = useAction();
  const prompt = usePrompt();
  const [working, setWorking] = useState(false);
  const [extra, setExtra] = useState('');
  const send = () => {
    if (prompt(askPrompt(ws, a, extra))) {
      setWorking(false);
      setExtra('');
    }
  };
  return (
    <div className="py-[7px]">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div>
            <ItemText text={a.text} url={a.url} />
          </div>
          <Meta>
            {a.asked_by}
            {a.source && ` · ${a.source}`} · {ago(a.ts)}
          </Meta>
        </div>
        {live && (
          <>
            <Button disabled={working} onClick={() => setWorking(true)}>
              Work on it
            </Button>
            <Button disabled={busy} onClick={() => run(() => api.askDone(a.id))}>
              Done
            </Button>
          </>
        )}
      </div>
      {working && (
        // No <form>: the artifact frame blocks submits. Cmd/Ctrl+Enter sends, Escape cancels.
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            autoFocus
            rows={3}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.preventDefault(), send());
              if (e.key === 'Escape') setWorking(false);
            }}
            placeholder="Extra context for the chat (optional): what you want to do, what you already know…"
            className="w-full rounded-md border border-line bg-raise px-2 py-[5px] font-[inherit] text-[13px] text-ink"
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setWorking(false)}>Cancel</Button>
            <Button variant="primary" onClick={send}>
              Send to chat
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Asks({ ws }: { ws: Workstream }) {
  if (!ws.asks.length) return null;
  return (
    <div className="mt-3.5 rounded-lg border border-l-4 border-needs px-4 py-3">
      <div className="mb-1 text-[11px] font-bold tracking-[.06em] text-needs uppercase">Needs you · {ws.asks.length}</div>
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {ws.asks.map((a) => (
          <AskRow key={a.id} ws={ws} a={a} />
        ))}
      </div>
    </div>
  );
}

function KeyPoints({ text }: { text: string }) {
  const points = parseKeyPoints(text);
  if (!points.length) return null;
  return (
    <>
      <SectionTitle>Key points</SectionTitle>
      <ul className="m-0 list-disc pl-5 [&>li]:my-[5px]">
        {points.map((p, i) => (
          <li key={i}>
            {p.label && <b>{p.label}: </b>}
            <Linkified text={p.text} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Prebriefs({ ws }: { ws: Workstream }) {
  const { live } = useApp();
  const prompt = usePrompt();
  const ref = wsRef(ws);
  const n = ws.prebriefs.length;
  return (
    <>
      <SectionTitle
        count={n ? `${plural(n, 'upcoming call')}` : 'none open'}
        action={
          <Button
            disabled={!live}
            onClick={() =>
              prompt(`Prebrief a call for ${ref} (${ws.name}). Follow the prebrief skill, ${SKILL}: ask me which call if you can't tell, then draft it with me.`)
            }
          >
            Prebrief a call
          </Button>
        }
      >
        Prebriefs
      </SectionTitle>
      {n > 0 && (
        <RowList>
          {ws.prebriefs.map((p) => (
            <PrebriefRow
              key={p.id}
              p={p}
              onOpen={() =>
                prompt(
                  `Continue prebrief #${p.id} for ${ref}. Follow the prebrief skill, ${SKILL}: \`python3 /home/agent/work/app/prebrief.py show ${p.id}\`, then link me the artifact and show me where it stands.`,
                )
              }
            />
          ))}
        </RowList>
      )}
    </>
  );
}

export function WorkstreamPage({ ws }: { ws: Workstream }) {
  const decisions = ws.notes.filter((n) => n.kind === 'decision');
  return (
    <>
      {ws.state === 'suggested' && <SuggestedBanner ws={ws} />}
      <div className="mt-[18px]">
        <div className="flex items-center gap-2.5 text-[19px] font-semibold">
          <RefTag ref_={ws.ref} />
          {ws.name} <StatusPill status={ws.status} />
          {ws.state === 'approved' && (
            <span className="ml-auto text-sm font-normal">
              <PriorityControl ws={ws} />
            </span>
          )}
        </div>
        <div className="text-muted">
          {ws.owner}
          {ws.epic_url && (
            <>
              {' · '}
              <ExtLink href={ws.epic_url}>{(ws.epic_label || 'Link').split(' ')[0]}</ExtLink>
            </>
          )}
          {' · '}updated {ago(ws.updated_at)}
        </div>
      </div>
      <Asks ws={ws} />
      <div className="mt-3.5 rounded-lg border-l-4 border-blue bg-blue-soft px-4 py-3 text-[14.5px]">
        <div className="mb-0.5 text-[11px] font-bold tracking-[.06em] text-blue">TL;DR</div>
        {ws.tldr || ws.status_note}
      </div>
      {ws.deadlines.length > 0 && (
        <>
          <SectionTitle count={ws.deadlines.length}>Deadlines</SectionTitle>
          <RowList>
            {ws.deadlines.map((d) => (
              <DeadlineRow key={d.id} d={d} />
            ))}
          </RowList>
        </>
      )}
      <KeyPoints text={ws.key_points ?? ''} />
      {ws.followups.length > 0 && (
        <>
          <SectionTitle count={ws.followups.length}>Follow-ups</SectionTitle>
          <RowList>
            {ws.followups.map((f) => (
              <FollowupRow key={f.id} f={f} />
            ))}
          </RowList>
        </>
      )}
      <Prebriefs ws={ws} />
      <SectionTitle count={ws.progress.length}>Progress</SectionTitle>
      <ProgressTimeline progress={ws.progress} />
      <details className="mt-7 border-t border-line pt-3 text-muted">
        <summary className="cursor-pointer font-semibold">Goal and decisions</summary>
        <p>
          <b>Goal:</b> {ws.goal}
        </p>
        {decisions.length > 0 && (
          <ul className="list-disc pl-5">
            {decisions.map((n) => (
              <li key={n.id} className="my-[3px]">
                {n.text}
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
}
