// The workstreams in four lanes stacked by priority: Focus today, High, Normal, Low. The owner reprioritises by
// dragging a row by its handle, within a lane (its place) or into another lane (its priority, or today's focus).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  closestCorners,
  DndContext,
  pointerWithin,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api/client';
import type { WorkstreamSummary } from '../../api/types';
import { Empty, cx } from '../../components/ui';
import { GROUP_KEYS, groupByPriority, moveId, wsRef, type GroupKey } from '../../lib/workstreams';
import { useApp } from '../../state/AppContext';
import { useAction } from '../../state/useAction';
import { WorkstreamRow, type DragHandle } from './WorkstreamRow';

type Lanes = Record<GroupKey, string[]>;

const LANE: Record<GroupKey, { title: string; hint: string; tone: string }> = {
  focus: { title: 'Focus today', hint: 'Drag a workstream here to focus on it today. It goes back tomorrow.', tone: 'text-focus' },
  high: { title: 'High priority', hint: 'Drag here what matters most.', tone: 'text-ink' },
  normal: { title: 'Normal', hint: 'Nothing at normal priority.', tone: 'text-muted' },
  low: { title: 'Low priority', hint: 'Drag here what you only follow.', tone: 'text-muted' },
};

const laneId = (k: GroupKey) => `lane:${k}`;
const isLane = (id: unknown) => String(id).startsWith('lane:');

/** What's under the pointer wins, a row before the lane it's in; only off every lane, the nearest. Plain
 *  closest-corner detection picks the lane above when a row is dragged up to the top of its own lane. */
const underPointer: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (!hits.length) return closestCorners(args);
  const rows = hits.filter((h) => !isLane(h.id));
  return rows.length ? rows : hits;
};

const lanesOf = (workstreams: WorkstreamSummary[]): Lanes =>
  Object.fromEntries(groupByPriority(workstreams).map((g) => [g.key, g.workstreams.map((w) => w.id)])) as Lanes;

/** Which lane an id (a row's, or a lane's own) is in. */
function laneOf(lanes: Lanes, id: string): GroupKey | undefined {
  if (isLane(id)) return id.slice(5) as GroupKey;
  return GROUP_KEYS.find((k) => lanes[k].includes(id));
}

function SortableRow({ ws }: { ws: WorkstreamSummary }) {
  const { live } = useApp();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: ws.id,
    disabled: !live,
  });
  const handle: DragHandle | undefined = live ? { ref: setActivatorNodeRef, props: { ...attributes, ...listeners } } : undefined;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx(isDragging && 'opacity-30')}>
      <WorkstreamRow ws={ws} handle={handle} />
    </div>
  );
}

interface LaneProps {
  k: GroupKey;
  ids: string[];
  byId: Map<string, WorkstreamSummary>;
  dragging: boolean;
  children: ReactNode;
}

function Lane({ k, ids, byId, dragging, children }: LaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId(k) });
  const { lowOpen, setLowOpen } = useApp();
  const { title, hint, tone } = LANE[k];
  // Low starts collapsed and stays as the owner left it; it opens while anything is dragged, so it can take a drop.
  const collapsible = k === 'low';
  const open = !collapsible || lowOpen || dragging;
  const needs = ids.filter((id) => (byId.get(id)?.asks_open ?? 0) > 0).length;

  return (
    <section className="mt-[18px]" aria-label={title}>
      <div
        onClick={collapsible ? () => setLowOpen(!lowOpen) : undefined}
        className={cx(
          'mb-1.5 flex items-baseline gap-2 text-xs font-bold tracking-[.06em] uppercase select-none',
          tone,
          collapsible && 'cursor-pointer',
        )}
      >
        {collapsible && <span className={cx('inline-block transition-transform', open && 'rotate-90')}>▸</span>}
        <span>{title}</span>
        <span className="font-normal tracking-normal normal-case">
          {ids.length}
          {!open && needs > 0 && ` · ${needs} need you`}
        </span>
      </div>
      {open && (
        <div
          ref={setNodeRef}
          className={cx(
            'overflow-hidden rounded-[10px] border transition-colors [&>*+*]:border-t [&>*+*]:border-line',
            k === 'focus' ? 'border-focus' : 'border-line',
            !ids.length && 'border-dashed',
            isOver && 'border-blue! bg-blue-soft',
          )}
        >
          <SortableContext id={laneId(k)} items={ids} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
          {!ids.length && <div className="px-4 py-3.5 text-[13px] text-muted">{hint}</div>}
        </div>
      )}
    </section>
  );
}

export function PriorityStack({ workstreams }: { workstreams: WorkstreamSummary[] }) {
  const { notify } = useApp();
  const { run } = useAction();
  const byId = useMemo(() => new Map(workstreams.map((w) => [w.id, w])), [workstreams]);
  const [lanes, setLanes] = useState<Lanes>(() => lanesOf(workstreams));
  const [active, setActive] = useState<{ id: string; from: GroupKey } | null>(null);

  // New data from the server replaces the local order, except in the middle of a drag.
  useEffect(() => {
    if (!active) setLanes(lanesOf(workstreams));
  }, [workstreams]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!workstreams.length) return <Empty>No workstreams yet. Ask the agent to suggest some.</Empty>;

  const reset = () => {
    setActive(null);
    setLanes(lanesOf(workstreams));
  };

  const onDragStart = ({ active: a }: DragStartEvent) => {
    const from = laneOf(lanes, String(a.id));
    if (from) setActive({ id: String(a.id), from });
  };

  // Over a row or a lane: move the dragged row to that spot now, so the lane opens a gap where it will land.
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
    const start = active;
    if (!over || !start) return reset();
    setActive(null);
    const id = String(a.id);
    const to = laneOf(lanes, id)!;
    const before = lanesOf(workstreams);
    if (to === start.from && lanes[to].join() === before[to].join()) return; // dropped where it was
    const ws = byId.get(id)!;
    void run(() => api.arrange(to, lanes[to])).then((ok) => {
      if (!ok) setLanes(before);
      else if (to !== start.from) notify('ok', `${wsRef(ws)} moved to ${LANE[to].title}.`);
    });
  };

  const dragged = active ? byId.get(active.id) : undefined;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={underPointer}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      {GROUP_KEYS.map((k) => (
        <Lane key={k} k={k} ids={lanes[k]} byId={byId} dragging={!!active}>
          {lanes[k].map((id) => {
            const ws = byId.get(id);
            return ws && <SortableRow key={id} ws={ws} />;
          })}
        </Lane>
      ))}
      <DragOverlay>
        {dragged && (
          <div className="overflow-hidden rounded-[10px] border border-blue shadow-xl">
            <WorkstreamRow ws={dragged} handle={{ props: {} }} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
