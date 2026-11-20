// Dashboard ordering: priority groups, and the order within one.
import type { GroupKey, Status, WorkstreamSummary } from '../api/types';

export type { GroupKey };

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

export const GROUP_KEYS = GROUPS.map(([k]) => k);

export const groupOf = (w: WorkstreamSummary): GroupKey => (w.focus ? 'focus' : (w.priority ?? 'normal'));

/** The owner's order first (where they dragged it), then the ones not placed yet, by urgency. */
export const byPlace = (a: WorkstreamSummary, b: WorkstreamSummary) =>
  (a.rank ?? Infinity) - (b.rank ?? Infinity) || byUrgency(a, b);

/** The dashboard's stack: Focus today, High, Normal, Low, every group present so it can take a drop. */
export function groupByPriority(list: WorkstreamSummary[]): Group[] {
  const sorted = [...list].sort(byPlace);
  return GROUPS.map(([key, title]) => ({ key, title, workstreams: sorted.filter((w) => groupOf(w) === key) }));
}

/** Move one id within or between groups of ids; what a drag does, as a pure function. */
export function moveId(
  groups: Record<GroupKey, string[]>,
  id: string,
  to: GroupKey,
  index: number,
): Record<GroupKey, string[]> {
  const out = Object.fromEntries(GROUP_KEYS.map((k) => [k, groups[k].filter((x) => x !== id)])) as Record<GroupKey, string[]>;
  const target = out[to];
  target.splice(Math.max(0, Math.min(index, target.length)), 0, id);
  return out;
}

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

/** A workstream's tile colour: one of eight accents, fixed by its permanent ref. */
export const accentOf = (ref: number | null | undefined) =>
  ref ? `var(--wsa-accent-${ref % 8})` : 'var(--wsa-accent-none)';

/** "Jan: release cut · Jenna: IBM sign-off" → the people, in order. */
export function parseRoles(roles: string | null | undefined): { name: string; role: string }[] {
  if (!roles) return [];
  return roles
    .split(/\s+·\s+|\n|;\s*/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const i = r.indexOf(':');
      return i > 0 ? { name: r.slice(0, i).trim(), role: r.slice(i + 1).trim() } : { name: r, role: '' };
    });
}

/** "Jenna Winkler" → "JW"; "Tomáš P." → "TP". */
export const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((p) => /^\p{L}/u.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

/** The refs a debrief says it touches, "W8, W15" → [8, 15]. */
export const refsIn = (text: string | null | undefined): number[] =>
  [...(text ?? '').matchAll(/W(\d+)/g)].map((m) => Number(m[1]));
