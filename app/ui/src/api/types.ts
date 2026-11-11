// The shapes the API returns (app/server.py, built in app/db.py). Rows come straight from SQLite.

export type Status = 'red' | 'amber' | 'green';
export type Priority = 'high' | 'normal' | 'low';
export type Outcome = 'pass' | 'fail' | 'blocked' | 'done' | 'risk' | 'info';
export type ProgressType = 'pr' | 'ticket' | 'meeting' | 'message' | 'doc' | 'release' | 'update';

export interface Deadline {
  id: number;
  workstream_id: string;
  text: string;
  due: string; // YYYY-MM-DD, or an ISO time when the hour matters
  original_due: string;
  firm: 0 | 1;
  source: string;
  url: string | null;
  state: 'open' | 'met' | 'missed' | 'dropped';
  ws_ref?: number; // on Coming up only
  ws_name?: string;
}

export interface Followup {
  id: number;
  workstream_id: string | null;
  text: string;
  waiting_on: string;
  next_step: string;
  source: string;
  url: string | null;
  ts: string;
}

export interface Ask {
  id: number;
  workstream_id: string;
  text: string;
  asked_by: string;
  source: string;
  url: string | null;
  ts: string;
}

export interface ProgressEntry {
  id: number;
  ts: string;
  type: ProgressType | string;
  outcome: Outcome;
  summary: string;
  url: string | null;
}

export interface Note {
  id: number;
  kind: 'decision' | 'principle' | 'later';
  text: string;
}

export interface Prebrief {
  id: number;
  title: string;
  meeting_ts: string | null;
  attendees: string;
  artifact_id: string;
}

export interface Debrief {
  id: number;
  title: string;
  url: string | null;
  why: string;
  workstreams: string;
  meeting_ts: string | null;
  source_name?: string;
  state: 'proposed' | 'started' | 'done' | 'dismissed';
  started_at: string | null;
}

interface WorkstreamBase {
  id: string;
  ref: number | null;
  name: string;
  goal: string;
  owner: string;
  tldr: string;
  status: Status;
  priority: Priority;
  priority_by: '' | 'owner' | 'agent';
  priority_why: string;
  focus: boolean;
  asks_open?: number;
  followups_open?: number;
}

/** A row on the dashboard. */
export interface WorkstreamSummary extends WorkstreamBase {
  status_note: string;
  asks_open: number;
  followups_open: number;
  last_activity: string | null;
  next_deadline: Deadline | null;
}

/** A suggested workstream, waiting for the owner's approval. */
export type Suggestion = WorkstreamBase & { asks_open: number };

/** One workstream's page. */
export interface Workstream extends WorkstreamBase {
  state: 'suggested' | 'approved' | 'rejected';
  status_note: string;
  key_points: string;
  epic_label: string | null;
  epic_url: string | null;
  updated_at: string;
  asks: Ask[];
  followups: Followup[];
  deadlines: Deadline[];
  prebriefs: Prebrief[];
  progress: ProgressEntry[];
  notes: Note[];
}

export interface Summary {
  me: string;
  github_repo: string;
  generated_at: string;
  app_version?: string;
  workstreams: WorkstreamSummary[];
  suggested: Suggestion[];
  followups: Followup[];
  debriefs: Debrief[];
  deadlines: Deadline[];
}

/** What build.py embeds in the page for when the server can't be reached. */
export interface Snapshot {
  summary: Summary;
  workstreams: Record<string, Workstream>;
}

export interface WorkstreamPatch {
  priority?: Priority;
  focus?: boolean;
}
