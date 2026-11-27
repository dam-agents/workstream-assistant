// The list beside the open pane: only the workstreams, in four lanes: Focus today, High, Other (normal) and Low. The owner reprioritises by dragging a row, within a lane
// (its place) or into another one (its priority, or today's focus).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api/client';
import type { Summary, WorkstreamSummary } from '../../api/types';
import { Icon } from '../../components/icons';
import { IconButton, Tile, cx } from '../../components/ui';
import { daysLeft, dueShort } from '../../lib/format';
import { GROUP_KEYS, groupByPriority, moveId, wsRef, type GroupKey } from '../../lib/workstreams';
import { useApp } from '../../state/AppContext';
import { useAction } from '../../state/useAction';
import type { Connection } from '../../state/useViewData';

type Lanes = Record<GroupKey, string[]>;

export const LANE: Record<GroupKey, { title: string; hint: string }> = {
  focus: { title: 'Focus today', hint: 'Drop here to focus on it today. It goes back tomorrow.' },
  high: { title: 'High priority', hint: 'Drag here what matters most.' },
  normal: { title: 'Other', hint: 'Drop here for normal priority.' },
  low: { title: 'Low priority', hint: 'Drag here what you only follow.' },
};

const laneId = (k: GroupKey) => `lane:${k}`;
const isLane = (id: unknown) => String(id).startsWith('lane:');

/** What's under the pointer wins, a row before the lane it's in; only off every lane, the nearest. */
const underPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (!hits.length) return closestCorners(args);
  const rows = hits.filter((h) => !isLane(h.id));
  return rows.length ? rows : hits;
};

const lanesOf = (workstreams: WorkstreamSummary[]): Lanes =>
  Object.fromEntries(groupByPriority(workstreams).map((g) => [g.key, g.workstreams.map((w) => w.id)])) as Lanes;

function laneOf(lanes: Lanes, id: string): GroupKey | undefined {
  if (isLane(id)) return id.slice(5) as GroupKey;
  return GROUP_KEYS.find((k) => lanes[k].includes(id));
}

/** The order the sidebar shows workstreams in, for the default pick and the arrow keys. */
export const sidebarOrder = (workstreams: WorkstreamSummary[]) => groupByPriority(workstreams).flatMap((g) => g.workstreams);

// A drag ends with a click on whatever is under the pointer; that click must not open it.
let lastDragEnd = 0;

const SEL = 'bg-blue text-white [&_[data-pill]]:bg-white/20 [&_[data-pill]]:text-white [&_[data-dot]]:bg-white [&_[data-sub]]:text-white/85';

function RowShell({ selected, onOpen, children, label, dragProps }: { selected: boolean; onOpen: () => void; children: ReactNode; label: string; dragProps?: object }) {
  return (
    <a
      href="#"
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (Date.now() - lastDragEnd > 250) onOpen();
      }}
      {...dragProps}
      className={cx(
        'relative grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-ink no-underline transition-colors select-none hover:no-underline',
        selected ? SEL : 'hover:bg-fill2',
      )}
    >
      {children}
    </a>
  );
}

function Badge({ n, quiet, title }: { n: number; quiet?: boolean; title?: string }) {
  if (!n) return null;
  return (
    <span
      title={title}
      data-pill
      className={cx(
        'grid h-5 min-w-5 flex-none place-items-center rounded-[10px] px-1.5 text-[11.5px] font-bold tabular-nums',
        quiet ? 'bg-fill text-muted' : 'bg-blue text-white',
      )}
    >
      {n}
    </span>
  );
}

const STATUS_DOT = { red: ['At risk', 'bg-red-dot'], amber: ['Watch', 'bg-amber-dot'], green: ['On track', 'bg-green-dot'] } as const;

/** A row: the tile, the full name, how much needs the owner, and one quiet line with status and the next due date. */
export function WorkstreamItem({ ws, selected }: { ws: WorkstreamSummary; selected: boolean }) {
  const d = ws.next_deadline;
  const late = d && daysLeft(d.due) < 0;
  const [label, dot] = STATUS_DOT[ws.status];
  return (
    <>
      <span className="mt-px">
        <Tile ref_={ws.ref} size={26} />
      </span>
      <div className="min-w-0" title={ws.status_note || undefined}>
        <div className="flex items-start justify-between gap-2">
          <b className="text-sm leading-[1.3] font-semibold [overflow-wrap:anywhere]">{ws.name}</b>
          <Badge n={ws.asks_open} title="Needs you" />
        </div>
        <div data-sub className="mt-[3px] flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <i data-dot className={cx('size-1.5 rounded-full', dot)} />
          <span>{label}</span>
          {d && (
            <>
              <span aria-hidden>·</span>
              <span className={cx(late && 'font-semibold', late && !selected && 'text-red')}>{dueShort(d.due)}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SortableRow({ ws, selected, draggable }: { ws: WorkstreamSummary; selected: boolean; draggable: boolean }) {
  const { navigate } = useApp();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ws.id, disabled: !draggable });
  // Pointer only: Enter and Space on a row open it, they don't pick it up. The page's priority picker is the keyboard way.
  const dragProps = draggable ? { onPointerDown: listeners?.onPointerDown, 'aria-roledescription': attributes['aria-roledescription'] } : undefined;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx('list-none', isDragging && 'opacity-30')}>
      <RowShell
        selected={selected}
        label={`${wsRef(ws)} ${ws.name}`}
        onOpen={() => navigate({ view: 'ws', id: ws.id })}
        dragProps={dragProps}
      >
        <WorkstreamItem ws={ws} selected={selected} />
      </RowShell>
    </li>
  );
}

function LaneHead({ k, n, open, onToggle, needs }: { k: GroupKey; n: number; open: boolean; onToggle?: () => void; needs: number }) {
  return (
    <h5
      onClick={onToggle}
      className={cx(
        'mx-2.5 mt-4 mb-1 flex items-baseline justify-between text-[11.5px] font-semibold tracking-[.01em] text-faint select-none',
        onToggle && 'cursor-pointer hover:text-muted',
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {k === 'focus' && (
          <span className="text-star [&_svg]:fill-current">
            <Icon name="star" width={1.7} className="size-3" />
          </span>
        )}
        {onToggle && (
          <span className={cx('inline-block transition-transform', open && 'rotate-90')}>
            <Icon name="chevron" width={2.4} className="size-2.5" />
          </span>
        )}
        {LANE[k].title}
      </span>
      <span>
        {n}
        {!open && needs > 0 && ` · ${needs} need you`}
      </span>
    </h5>
  );
}

function Lane({ k, ids, byId, dragging, children }: { k: GroupKey; ids: string[]; byId: Map<string, WorkstreamSummary>; dragging: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId(k) });
  const { lowOpen, setLowOpen } = useApp();
  const collapsible = k === 'low';
  const open = !collapsible || lowOpen || dragging;
  const needs = ids.filter((id) => (byId.get(id)?.asks_open ?? 0) > 0).length;
  // An empty lane shows only while dragging, so it can take a drop.
  if (!ids.length && !dragging) return null;
  return (
    <section aria-label={LANE[k].title}>
      <LaneHead k={k} n={ids.length} open={open} needs={needs} onToggle={collapsible ? () => setLowOpen(!lowOpen) : undefined} />
      {open && (
        <ul ref={setNodeRef} className={cx('m-0 rounded-xl p-0 transition-colors', isOver && 'bg-blue-soft')}>
          <SortableContext id={laneId(k)} items={ids} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
          {!ids.length && (
            <li className="mx-2.5 my-0.5 list-none rounded-[10px] border border-dashed border-line-strong px-3 py-2.5 text-[12.5px] text-faint">{LANE[k].hint}</li>
          )}
        </ul>
      )}
    </section>
  );
}

function Workstreams({ workstreams, selected, query }: { workstreams: WorkstreamSummary[]; selected: string | null; query: string }) {
  const { notify, live } = useApp();
  const { run } = useAction();
  const byId = useMemo(() => new Map(workstreams.map((w) => [w.id, w])), [workstreams]);
  const [lanes, setLanes] = useState<Lanes>(() => lanesOf(workstreams));
  const [active, setActive] = useState<{ id: string; from: GroupKey } | null>(null);

  useEffect(() => {
    if (!active) setLanes(lanesOf(workstreams));
  }, [workstreams]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const q = query.trim().toLowerCase();
  const matches = (w: WorkstreamSummary) => !q || `${wsRef(w)} ${w.name} ${w.status_note} ${w.tldr} ${w.owner}`.toLowerCase().includes(q);
  // A filtered lane can't be saved in order: the hidden rows would lose their place.
  const draggable = live && !q;

  if (!workstreams.length) return <p className="mx-2.5 my-6 text-center text-[13.5px] text-muted">No workstreams yet. Ask the agent to suggest some.</p>;
  if (q && !workstreams.some(matches)) return <p className="mx-2.5 my-6 text-center text-[13.5px] text-muted">No workstreams match your search.</p>;

  const reset = () => {
    setActive(null);
    setLanes(lanesOf(workstreams));
  };
  const onDragStart = ({ active: a }: DragStartEvent) => {
    const from = laneOf(lanes, String(a.id));
    if (from) setActive({ id: String(a.id), from });
  };
  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (!over || over.id === a.id) return;
    const id = String(a.id);
    const to = laneOf(lanes, String(over.id));
    if (!to) return;
    const at = lanes[to].indexOf(String(over.id));
    const next = moveId(lanes, id, to, at < 0 ? lanes[to].length : at);
    if (GROUP_KEYS.some((k) => next[k].join() !== lanes[k].join())) setLanes(next);
  };
  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    lastDragEnd = Date.now();
    const start = active;
    if (!over || !start) return reset();
    setActive(null);
    const id = String(a.id);
    const to = laneOf(lanes, id)!;
    const before = lanesOf(workstreams);
    if (to === start.from && lanes[to].join() === before[to].join()) return;
    const ws = byId.get(id)!;
    void run(() => api.arrange(to, lanes[to])).then((ok) => {
      if (!ok) setLanes(before);
      else if (to !== start.from) notify('ok', `${ws.name} moved to ${LANE[to].title}.`);
    });
  };

  const dragged = active ? byId.get(active.id) : undefined;
  return (
    <DndContext sensors={sensors} collisionDetection={underPointer} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={reset}>
      {GROUP_KEYS.map((k) => {
        const ids = lanes[k].filter((id) => byId.has(id) && matches(byId.get(id)!));
        if (q && !ids.length) return null;
        return (
          <Lane key={k} k={k} ids={ids} byId={byId} dragging={!!active}>
            {ids.map((id) => (
              <SortableRow key={id} ws={byId.get(id)!} selected={selected === id} draggable={draggable} />
            ))}
          </Lane>
        );
      })}
      <DragOverlay>
        {dragged && (
          <div className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5 rounded-[10px] bg-raise px-2.5 py-2 shadow-pop">
            <WorkstreamItem ws={dragged} selected={false} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export function needsCount(s: Summary) {
  const n = s.workstreams.reduce((n, w) => n + w.asks_open, 0) + s.followups.filter((f) => f.waiting_on === s.me).length;
  const across = s.workstreams.filter((w) => w.asks_open).length + (s.followups.some((f) => f.waiting_on === s.me) ? 1 : 0);
  return { n, across };
}

export function Sidebar({ s, selected, conn, onRefresh, onReload, below }: { s: Summary | null; selected: string | null; conn: Connection; onRefresh: () => void; onReload: () => void; below?: ReactNode }) {
  const { live } = useApp();
  const [query, setQuery] = useState('');
  const [spin, setSpin] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const connLabel = conn.state === 'live' ? 'Live' : conn.state === 'snapshot' ? 'Snapshot' : s ? 'Updating…' : 'Loading…';

  return (
    <aside className="flex min-h-0 min-w-0 flex-col" aria-label="Your Work">
      <div className="px-3.5 pt-4 pb-2">
        <div className="mx-1 mb-2.5 flex items-center gap-2">
          <h1 className="m-0 mr-auto font-display text-xl font-bold tracking-[-0.022em]">Your Work</h1>
          <button
            type="button"
            onClick={onReload}
            title={conn.state === 'live' ? 'The agent keeps this page up to date. Click to reload.' : 'Reload'}
            className="inline-flex cursor-pointer items-center gap-[5px] border-0 bg-transparent p-0 text-xs text-muted hover:text-ink"
          >
            <i className={cx('size-[7px] rounded-full', conn.state === 'live' ? 'live-dot bg-green-dot' : conn.state === 'snapshot' ? 'bg-amber-dot' : 'bg-grey-dot')} />
            {connLabel}
          </button>
          <span key={spin}>
            <IconButton
              icon="refresh"
              label="Ask agent to refresh"
              spin={spin > 0}
              onClick={() => {
                setSpin((n) => n + 1);
                onRefresh();
              }}
            />
          </span>
        </div>
        <label className="flex h-8 items-center gap-1.5 rounded-[9px] bg-fill px-2.5 text-faint focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--wsa-blue)_40%,transparent)]">
          <Icon name="search" width={2} className="size-[15px] flex-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Search"
            aria-label="Search workstreams"
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </label>
        {below}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-2 pt-0.5 pb-[18px] [scrollbar-width:thin]">
        {s ? (
          <Workstreams workstreams={s.workstreams} selected={selected?.startsWith('ws:') ? selected.slice(3) : null} query={query} />
        ) : (
          <p className="mx-2.5 my-6 text-center text-[13.5px] text-muted">{conn.state === 'loading' ? 'Loading…' : 'Nothing here.'}</p>
        )}
        {!live && s && <p className="mx-2.5 mt-4 text-[11.5px] text-faint">Drag to reprioritise works with live data only.</p>}
      </div>
    </aside>
  );
}
