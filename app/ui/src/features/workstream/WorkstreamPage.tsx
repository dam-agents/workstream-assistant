// One workstream: what needs the owner, TL;DR, deadlines, key points, follow-ups, prebriefs, progress.
import { api } from '../../api/client';
import type { Workstream } from '../../api/types';
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

function Asks({ ws }: { ws: Workstream }) {
  const { live } = useApp();
  const { busy, run } = useAction();
  if (!ws.asks.length) return null;
  return (
    <div className="mt-3.5 rounded-lg border border-l-4 border-needs px-4 py-3">
      <div className="mb-1 text-[11px] font-bold tracking-[.06em] text-needs uppercase">Needs you · {ws.asks.length}</div>
      <div className="[&>*+*]:border-t [&>*+*]:border-line">
        {ws.asks.map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-[7px]">
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
              <Button disabled={busy} onClick={() => run(() => api.askDone(a.id))}>
                Done
              </Button>
            )}
          </div>
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
