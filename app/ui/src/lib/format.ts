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

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Days from today to a timestamp's day, in the viewer's calendar: 0 today, -1 yesterday. */
export const dayOffset = (ts: string, now = new Date()) => Math.round((startOfDay(new Date(ts)) - startOfDay(now)) / 864e5);

/** "20 Nov" */
export const shortDate = (ts: string) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** A timeline day's heading: Today, Yesterday, the weekday within the last week, else the date. */
export function dayLabel(ts: string, now = new Date()): string {
  const n = dayOffset(ts, now);
  if (n === 0) return 'Today';
  if (n === -1) return 'Yesterday';
  if (n > -7 && n < 0) return new Date(ts).toLocaleDateString('en-GB', { weekday: 'long' });
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** A due date the short way: Overdue, Due today, Due tomorrow, Due Friday, Due 7 Dec. */
export function dueShort(due: string, now = new Date()): string {
  const n = daysLeft(due, now);
  if (n < 0) return 'Overdue';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  const d = new Date(due.slice(0, 10) + 'T12:00:00');
  if (n < 7) return `Due ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`;
  return `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}
