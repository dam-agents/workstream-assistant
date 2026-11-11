// Dashboard ordering: priority groups, and the order within one.
import type { Priority, Status, WorkstreamSummary } from '../api/types';

export type GroupKey = 'focus' | Priority;

export interface Group {
  key: GroupKey;
  title: string;
  workstreams: WorkstreamSummary[];
}

const STATUS_ORDER: Record<Status, number> = { red: 0, amber: 1, green: 2 };

/** Within a group: what needs the owner first, then the riskiest, then by name. */
export const byUrgency = (a: WorkstreamSummary, b: WorkstreamSummary) =>
  Number(b.asks_open > 0) - Number(a.asks_open > 0) ||
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
  a.name.localeCompare(b.name);

const GROUPS: [GroupKey, string][] = [
  ['focus', 'Focus today'],
  ['high', 'High priority'],
  ['normal', 'Normal'],
  ['low', 'Low priority'],
];

const groupOf = (w: WorkstreamSummary): GroupKey => (w.focus ? 'focus' : (w.priority ?? 'normal'));

/** The dashboard's stack: Focus today, High, Normal, Low; empty groups left out. */
export function groupByPriority(list: WorkstreamSummary[]): Group[] {
  const sorted = [...list].sort(byUrgency);
  return GROUPS.map(([key, title]) => ({ key, title, workstreams: sorted.filter((w) => groupOf(w) === key) })).filter(
    (g) => g.workstreams.length > 0,
  );
}

/** Nothing prioritised yet: the dashboard shows one plain list, as before priorities existed. */
export const isUngrouped = (groups: Group[]) => groups.length === 1 && groups[0].key === 'normal';

export const wsRef = (w: { ref: number | null; id: string }) => (w.ref ? `W${w.ref}` : w.id);

/** "Label: text" key points, one per line. A short head before ": " is the label. */
export function parseKeyPoints(text: string): { label?: string; text: string }[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((p) => {
      const [head, ...rest] = p.split(': ');
      return rest.length && head.length < 20 ? { label: head, text: rest.join(': ') } : { text: p };
    });
}
