// Dates and times as the page shows them. Pure functions of their input and `now`, so they're testable.

export const fmtDay = (ts: string) =>
  new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtTime = (ts: string) => ts.slice(11, 16);

/** Deadlines are dates ("2026-11-02") or ISO times; count days in the viewer's calendar so the snapshot stays right. */
export function daysLeft(due: string, now = new Date()): number {
  const [y, m, d] = due.slice(0, 10).split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 864e5);
}

export const fmtDue = (due: string) => fmtDay(due.slice(0, 10) + 'T12:00:00') + (due.length > 10 ? ' ' + fmtTime(due) : '');

export type Tone = 'red' | 'amber' | 'green' | 'grey' | 'blue' | 'needs' | 'focus';

/** How soon a deadline is, and how loudly to say it. */
export function dueWhen(due: string, now = new Date()): [string, Tone] {
  const n = daysLeft(due, now);
  if (n < 0) return [`overdue by ${-n} day${n < -1 ? 's' : ''}`, 'red'];
  if (n === 0) return ['today', 'red'];
  if (n === 1) return ['tomorrow', 'amber'];
  return [`in ${n} days`, n <= 3 ? 'amber' : 'grey'];
}

export function ago(ts: string | null | undefined, now = Date.now()): string {
  if (!ts) return 'never';
  const h = (now - new Date(ts).getTime()) / 36e5;
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const plural = (n: number, word: string, many = word + 's') => `${n} ${n === 1 ? word : many}`;
