// Loads what the current route shows: live from the API, else the snapshot build.py embedded.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, offlineMessage, PAGE_VERSION, readSnapshot } from '../api/client';
import type { Summary, Workstream } from '../api/types';
import { useApp, type Route } from './AppContext';

export type ViewData = { view: 'dash'; data: Summary } | { view: 'ws'; data: Workstream };

export interface Connection {
  state: 'loading' | 'live' | 'snapshot';
  /** Why live data isn't shown, with when the snapshot is from. */
  offline?: string;
  /** The API's template differs from the one this page was built from: a Kit Update since publishing. */
  stale: boolean;
}

const REFRESH_ON_FOCUS_MS = 30_000;

export function useViewData(): { view: ViewData | null; conn: Connection } {
  const { route, reloadKey, reload, live, setLive, setOwner } = useApp();
  const snap = useMemo(readSnapshot, []);
  const [view, setView] = useState<ViewData | null>(null);
  const [conn, setConn] = useState<Connection>({ state: 'loading', stale: false });
  const lastLoad = useRef(0);

  const routeKey = route.view === 'ws' ? `ws:${route.id}` : 'dash';
  const shown = useRef(routeKey);

  const load = useCallback(
    async (r: Route, signal: { cancelled: boolean }) => {
      lastLoad.current = Date.now();
      setConn((c) => ({ ...c, state: 'loading' }));
      try {
        const next: ViewData =
          r.view === 'ws' ? { view: 'ws', data: await api.workstream(r.id) } : { view: 'dash', data: await api.summary() };
        if (signal.cancelled) return;
        if (next.view === 'dash') setOwner(next.data.me, next.data.github_repo);
        const version = (next.data as { app_version?: string }).app_version;
        setLive(true);
        setView(next);
        setConn({ state: 'live', stale: !!version && version !== PAGE_VERSION });
      } catch (err) {
        if (signal.cancelled) return;
        setLive(false);
        const fallback: ViewData | null = !snap
          ? null
          : r.view === 'ws'
            ? snap.workstreams[r.id]
              ? { view: 'ws', data: snap.workstreams[r.id] }
              : null
            : { view: 'dash', data: snap.summary };
        setView(fallback);
        const when = snap ? new Date(snap.summary.generated_at).toLocaleString('en-GB') : 'never';
        setConn({ state: 'snapshot', stale: false, offline: `${offlineMessage(err)} Showing the snapshot from ${when}.` });
      }
    },
    [snap, setLive, setOwner],
  );

  useEffect(() => {
    if (shown.current !== routeKey) {
      shown.current = routeKey;
      setView(null); // a new page: show Loading, not the previous page
    }
    const signal = { cancelled: false };
    void load(route, signal);
    return () => {
      signal.cancelled = true;
    };
    // routeKey stands for route (a new object on every navigate); reloadKey forces a load
  }, [routeKey, reloadKey, load]);

  useEffect(() => {
    const onFocus = () => {
      const editing = document.activeElement?.tagName === 'INPUT';
      if (live && !editing && Date.now() - lastLoad.current > REFRESH_ON_FOCUS_MS) reload();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [live, reload]);

  return { view, conn };
}
