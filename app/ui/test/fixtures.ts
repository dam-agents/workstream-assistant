import type { Summary, WorkstreamSummary } from '../src/api/types';

export const ws = (over: Partial<WorkstreamSummary> & { id: string }): WorkstreamSummary => ({
  ref: null,
  name: over.id,
  goal: '',
  owner: 'Owner',
  tldr: '',
  status: 'amber',
  status_note: '',
  priority: 'normal',
  priority_by: '',
  priority_why: '',
  focus: false,
  rank: null,
  asks_open: 0,
  followups_open: 0,
  last_activity: null,
  next_deadline: null,
  ...over,
});

export const summary = (workstreams: WorkstreamSummary[]): Summary => ({
  me: 'Owner',
  github_repo: 'o/r',
  generated_at: '2026-11-11T09:00:00+01:00',
  workstreams,
  suggested: [],
  followups: [],
  debriefs: [],
  deadlines: [],
});
