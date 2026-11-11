import { ago, daysLeft, dueWhen } from '../src/lib/format';
import { linkifyRefs, sourceKind } from '../src/lib/links';
import { groupByPriority, isUngrouped, parseKeyPoints } from '../src/lib/workstreams';
import { ws } from './fixtures';

const NOW = new Date(2026, 10, 11, 9, 0); // Wed 11 Nov 2026, local time

describe('deadlines', () => {
  it('counts days in the viewer calendar', () => {
    expect(daysLeft('2026-11-11', NOW)).toBe(0);
    expect(daysLeft('2026-11-18T14:00:00+01:00', NOW)).toBe(7);
    expect(daysLeft('2026-11-09', NOW)).toBe(-2);
  });
  it('says how soon, and how loudly', () => {
    expect(dueWhen('2026-11-09', NOW)).toEqual(['overdue by 2 days', 'red']);
    expect(dueWhen('2026-11-12', NOW)).toEqual(['tomorrow', 'amber']);
    expect(dueWhen('2026-11-14', NOW)).toEqual(['in 3 days', 'amber']);
    expect(dueWhen('2026-11-20', NOW)).toEqual(['in 9 days', 'grey']);
  });
  it('ago', () => {
    const now = NOW.getTime();
    expect(ago(null, now)).toBe('never');
    expect(ago(new Date(now - 5 * 36e5).toISOString(), now)).toBe('5h ago');
    expect(ago(new Date(now - 50 * 36e5).toISOString(), now)).toBe('2d ago');
  });
});

describe('priority groups', () => {
  it('stacks Focus today, High, Normal, Low, and leaves out empty groups', () => {
    const groups = groupByPriority([
      ws({ id: 'a', priority: 'low' }),
      ws({ id: 'b', priority: 'high' }),
      ws({ id: 'c', priority: 'high', focus: true }),
      ws({ id: 'd' }),
    ]);
    expect(groups.map((g) => [g.key, g.workstreams.map((w) => w.id)])).toEqual([
      ['focus', ['c']],
      ['high', ['b']],
      ['normal', ['d']],
      ['low', ['a']],
    ]);
  });
  it('puts what needs the owner first, then the riskiest, within a group', () => {
    const [g] = groupByPriority([
      ws({ id: 'green', status: 'green', name: 'A' }),
      ws({ id: 'red', status: 'red', name: 'B' }),
      ws({ id: 'asks', status: 'green', asks_open: 2, name: 'C' }),
    ]);
    expect(g.workstreams.map((w) => w.id)).toEqual(['asks', 'red', 'green']);
  });
  it('is one plain list until something is prioritised', () => {
    expect(isUngrouped(groupByPriority([ws({ id: 'a' }), ws({ id: 'b' })]))).toBe(true);
    expect(isUngrouped(groupByPriority([ws({ id: 'a', priority: 'low' })]))).toBe(false);
  });
});

describe('text', () => {
  it('parses key points with short labels only', () => {
    expect(parseKeyPoints('Blocker: CI red\nA very long sentence that has: a colon\n')).toEqual([
      { label: 'Blocker', text: 'CI red' },
      { text: 'A very long sentence that has: a colon' },
    ]);
  });
  it('links #123 and PR #123 to the repository', () => {
    expect(linkifyRefs('see #4403 and PR #6401.', 'o/r')).toEqual([
      'see ',
      { label: '#4403', href: 'https://github.com/o/r/issues/4403' },
      ' and ',
      { label: 'PR #6401', href: 'https://github.com/o/r/pull/6401' },
      '.',
    ]);
    expect(linkifyRefs('#4403', '')).toEqual(['#4403']);
  });
  it('names the source of a link', () => {
    expect(sourceKind('https://x.slack.com/archives/C1/p1')).toBe('Slack');
    expect(sourceKind('https://github.com/o/r/pull/1')).toBe('GitHub');
    expect(sourceKind(null)).toBe('');
  });
});
