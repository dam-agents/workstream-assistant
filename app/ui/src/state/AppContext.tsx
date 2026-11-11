// App-wide state: the route, whether data is live, the notice line, and who the owner is.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { readSnapshot } from '../api/client';

export type Route = { view: 'dash' } | { view: 'ws'; id: string };

export type NoticeKind = 'warn' | 'err' | 'ok';
export interface Notice {
  kind: NoticeKind;
  text: string;
}

interface AppState {
  route: Route;
  navigate(route: Route): void;
  /** True once the API answered; buttons that write are disabled without it. */
  live: boolean;
  setLive(live: boolean): void;
  notice: Notice | null;
  notify(kind: NoticeKind, text: string): void;
  clearNotice(): void;
  /** Bumped to make the current view load again. */
  reloadKey: number;
  reload(): void;
  me: string;
  repo: string;
  setOwner(me: string, repo: string): void;
  /** The dashboard's Low priority group is open; kept while the owner visits a workstream and comes back. */
  lowOpen: boolean;
  setLowOpen(open: boolean): void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const snap = useMemo(readSnapshot, []);
  const [route, setRoute] = useState<Route>({ view: 'dash' });
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lowOpen, setLowOpen] = useState(false);
  const [owner, setOwnerState] = useState({ me: snap?.summary.me ?? '', repo: snap?.summary.github_repo ?? '' });

  const navigate = useCallback((r: Route) => {
    setNotice(null);
    setRoute(r);
    window.scrollTo(0, 0);
  }, []);
  const notify = useCallback((kind: NoticeKind, text: string) => setNotice({ kind, text }), []);
  const clearNotice = useCallback(() => setNotice(null), []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const setOwner = useCallback(
    (me: string, repo: string) => setOwnerState((o) => (o.me === me && o.repo === repo ? o : { me, repo })),
    [],
  );

  const value = useMemo<AppState>(
    () => ({ route, navigate, live, setLive, notice, notify, clearNotice, reloadKey, reload, ...owner, setOwner, lowOpen, setLowOpen }),
    [route, navigate, live, notice, notify, clearNotice, reloadKey, reload, owner, setOwner, lowOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}
