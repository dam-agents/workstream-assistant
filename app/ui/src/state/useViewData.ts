// Loads what the page shows: the summary (the sidebar and the inbox panes) and, when one is open, a workstream.
// Live from the API, else the snapshot build.py embedded.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, offlineMessage, PAGE_VERSION, readSnapshot } from '../api/client';
import type { Summary, Workstream } from '../api/types';
import { useApp } from './AppContext';

export interface Connection {
  state: 'loading' | 'live' | 'snapshot';
  /** Why live data isn't shown, with when the snapshot is from. */
  offline?: string;
  /** The API's template differs from the one this page was built from: a Kit Update since publishing. */
  stale: boolean;
}

export interface ViewData {
  summary: Summary | null;
  /** The open workstream; null while it loads, or when none is open. */
  ws: Workstream | null;
  conn: Connection;
}

const REFRESH_ON_FOCUS_MS = 30_000;

/** Load the summary and, when `wsId` is set, that workstream. */
export function useViewData(wsId: string | null): ViewData {
  const { reloadKey, reload, live, setLive, setOwner } = useApp();
  const snap = useMemo(readSnapshot, []);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ws, setWs] = useState<Workstream | null>(null);
  const [conn, setConn] = useState<Connection>({ state: 'loading', stale: false });
  const lastLoad = useRef(0);
  const shown = useRef<string | null | undefined>(undefined);

  const load = useCallback(
    async (id: string | null, signal: { cancelled: boolean }) => {
      lastLoad.current = Date.now();
      setConn((c) => ({ ...c, state: 'loading' }));
      try {
        const [s, w] = await Promise.all([api.summary(), id ? api.workstream(id) : Promise.resolve(null)]);
        if (signal.cancelled) return;
        setOwner(s.me, s.github_repo);
        setLive(true);
        setSummary(s);
        setWs(w);
        setConn({ state: 'live', stale: !!s.app_version && s.app_version !== PAGE_VERSION });
      } catch (err) {
        if (signal.cancelled) return;
        setLive(false);
        setSummary(snap?.summary ?? null);
        setWs(id ? (snap?.workstreams[id] ?? null) : null);
        const when = snap ? new Date(snap.summary.generated_at).toLocaleString('en-GB') : 'never';
        setConn({ state: 'snapshot', stale: false, offline: `${offlineMessage(err)} Showing the snapshot from ${when}.` });
      }
    },
    [snap, setLive, setOwner],
  );

  useEffect(() => {
    if (shown.current !== wsId && wsId) setWs(null); // another workstream: show Loading, not the previous one
    shown.current = wsId;
    const signal = { cancelled: false };
    void load(wsId, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [wsId, reloadKey, load]);

  useEffect(() => {
    const onFocus = () => {
      const editing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');
      if (live && !editing && Date.now() - lastLoad.current > REFRESH_ON_FOCUS_MS) reload();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [live, reload]);

  return { summary, ws, conn };
}
