import { hasPlatform, rawRequest } from './platform';
import type { Debrief, Snapshot, Summary, Workstream, WorkstreamPatch } from './types';

/** Why a request failed, so the page can say what to do about it. */
export type FailReason = 'no-platform' | 'app-not-listening' | 'timeout' | 'http' | 'unknown';

export class ApiError extends Error {
  constructor(message: string, readonly reason: FailReason) {
    super(message);
  }
}

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? '';

/** The template this page was built from; build.py fills it in. */
export const PAGE_VERSION = meta('wsa-version');

export function readSnapshot(): Snapshot | null {
  try {
    return JSON.parse(document.getElementById('snapshot')?.textContent ?? '') as Snapshot;
  } catch {
    return null; // a dev build, or a page built without data
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!hasPlatform()) throw new ApiError('no platform', 'no-platform');
  path += (path.includes('?') ? '&' : '?') + 'page=' + PAGE_VERSION;
  let res;
  try {
    res = await rawRequest({ method, path, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch (e) {
    const reason = (e as { reason?: FailReason }).reason ?? 'unknown';
    throw new ApiError((e as Error).message ?? String(e), reason);
  }
  let data: unknown = null;
  try {
    data = JSON.parse(res.body);
  } catch {
    /* non-JSON */
  }
  if (res.status >= 400) {
    throw new ApiError((data as { error?: string } | null)?.error ?? `HTTP ${res.status}`, 'http');
  }
  return data as T;
}

const post = <T = unknown>(path: string, body?: unknown) => call<T>('POST', path, body);

/** Every endpoint the page uses. See app/README.md, API. */
export const api = {
  summary: () => call<Summary>('GET', '/api/summary'),
  workstream: (id: string) => call<Workstream>('GET', `/api/workstreams/${id}`),
  patchWorkstream: (id: string, patch: WorkstreamPatch) => call<Workstream>('PATCH', `/api/workstreams/${id}`, patch),
  approve: (id: string) => post(`/api/workstreams/${id}/approve`),
  reject: (id: string, reason: string) => post(`/api/workstreams/${id}/reject`, { reason }),
  askDone: (id: number) => post(`/api/asks/${id}/done`),
  followupDone: (id: number) => post(`/api/followups/${id}/done`),
  startDebrief: (id: number) => post<Debrief & { prompt: string }>(`/api/debriefs/${id}/start`),
  dismissDebrief: (id: number) => post(`/api/debriefs/${id}/dismiss`),
};

export function offlineMessage(err: unknown): string {
  const reason = err instanceof ApiError ? err.reason : (err as { reason?: FailReason })?.reason;
  if (reason === 'app-not-listening') return "The server isn't running. Ask the agent to start it, then retry.";
  if (reason === 'timeout') return "The agent didn't answer in time (it may be waking up).";
  if (reason === 'no-platform') return 'Live data works only in the docked preview beside the chat.';
  return `Couldn't reach the server: ${(err as Error)?.message ?? err}`;
}
