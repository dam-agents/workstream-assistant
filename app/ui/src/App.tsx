// The shell: the list beside the open pane, as one split view sized by its own width, not the window's. Docked
// beside the chat (~860px) and full screen, the two sit side by side; dragged narrow (<640px) they become two screens.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { conversationKey } from './api/platform';
import type { Summary, Workstream } from './api/types';
import { Button, cx } from './components/ui';
import { InboxBar, InboxPane, TABS } from './features/panes/Inbox';
import { Sidebar, sidebarOrder } from './features/sidebar/Sidebar';
import { refreshPrompt, WorkstreamPage } from './features/workstream/WorkstreamPage';
import { routeKey, useApp, type NoticeKind, type Route } from './state/AppContext';
import { SENT_TO_SESSION, usePrompt } from './state/useAction';
import { useViewData, type Connection } from './state/useViewData';

const NARROW = 640;

const BANNER: Record<NoticeKind, string> = {
  warn: 'bg-amber-soft text-amber',
  err: 'bg-red-soft text-red',
  ok: 'bg-green-soft text-green',
};

function Banner({ kind, children }: { kind: NoticeKind; children: ReactNode }) {
  return <div className={cx('flex flex-wrap items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-medium', BANNER[kind])}>{children}</div>;
}

function Banners({ conn }: { conn: Connection }) {
  const { reload } = useApp();
  const prompt = usePrompt();
  if (!conn.stale && !conn.offline) return null;
  return (
    <div className="mx-auto grid max-w-[1040px] gap-2 px-[clamp(16px,4cqi,36px)] pt-4">
      {conn.stale && (
        <Banner kind="warn">
          This page is out of date: the app was updated since it was published, so some sections may be missing.
          <Button small onClick={() => prompt('The Workstreams page is out of date. Rebuild and republish it (app/README.md, Publishing).', '')}>
            Ask agent to republish
          </Button>
        </Banner>
      )}
      {conn.offline && (
        <Banner kind="warn">
          {conn.offline}{' '}
          <Button small onClick={reload}>
            Retry
          </Button>
        </Banner>
      )}
    </div>
  );
}

/** The notice line, as a toast at the bottom of the page; it goes by itself, an error a little later. */
function Toast() {
  const { notice, clearNotice } = useApp();
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clearNotice, notice.kind === 'err' ? 9000 : 4000);
    return () => window.clearTimeout(t);
  }, [notice, clearNotice]);
  return (
    <div
      role="status"
      className={cx(
        'absolute bottom-[18px] left-1/2 z-40 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-[14px] py-2.5 pr-3 pl-4 text-[13.5px] shadow-pop transition-[opacity,translate] duration-400 ease-ios',
        notice?.kind === 'err' ? 'bg-red text-white' : 'bg-[color-mix(in_srgb,var(--wsa-text)_92%,transparent)] text-page',
        notice ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-5 opacity-0',
      )}
    >
      <span className="min-w-0">{notice?.text}</span>
      {notice && (
        <button type="button" onClick={clearNotice} aria-label="Dismiss" className="cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-0.5 font-semibold opacity-80 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}

function MainPane({ route, s, ws, conn }: { route: Route; s: Summary | null; ws: Workstream | null; conn: Connection }) {
  const loading = <div className="py-[60px] text-center text-muted">{conn.state === 'loading' ? 'Loading…' : 'Nothing here.'}</div>;
  if (route.view === 'ws') return ws && ws.id === route.id ? <WorkstreamPage ws={ws} s={s} /> : loading;
  if (!s) return loading;
  if (route.view === 'inbox') return <InboxPane s={s} tab={route.tab} />;
  return null;
}

export function App() {
  const { route, navigate, reload, narrow, setNarrow } = useApp();
  const frame = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const prompt = usePrompt();

  // The layout follows the page's own width. Without a measurement (tests), it's the wide one.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth > 0 && el.clientWidth < NARROW));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setNarrow]);

  // The summary is always loaded; a workstream too, when one is open. With nothing picked, a wide pane shows the
  // first list behind the bar that has something in it, Debriefs when nothing has.
  const { summary: s, ws, conn } = useViewData(route.view === 'ws' ? route.id : null);
  const firstTab = (s && TABS.find((t) => t.count(s) > 0)?.key) || 'debriefs';
  const shown: Route | null = route.view !== 'dash' ? route : narrow ? null : { view: 'inbox', tab: firstTab };
  const activeTab = shown?.view === 'inbox' ? shown.tab : null;
  const key = shown ? routeKey(shown) : null;

  // A new pane starts at its top.
  useEffect(() => {
    main.current?.scrollTo?.(0, 0);
  }, [key]);

  // Arrow keys walk the workstreams on a wide pane; Escape goes back to the list on a narrow one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest?.('input,textarea,[role=group]')) return;
      if (e.key === 'Escape' && narrow && route.view !== 'dash') return navigate({ view: 'dash' });
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !narrow && s) {
        const order = sidebarOrder(s.workstreams);
        if (!order.length) return;
        const cur = shown?.view === 'ws' ? order.findIndex((w) => w.id === shown.id) : -1;
        const next = order[Math.max(0, Math.min(order.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))];
        e.preventDefault();
        navigate({ view: 'ws', id: next.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [narrow, route, shown, s, navigate]);

  const refreshAll = () =>
    prompt(refreshPrompt(null), `Refresh: ${SENT_TO_SESSION}`, {
      // A fresh Session for each refresh, so it doesn't land in the middle of whatever the chat is doing.
      conversation: conversationKey('refresh', Date.now(), 'all'),
    });

  const listOnly = narrow && !shown;
  const paneOnly = narrow && !!shown;
  return (
    <div ref={frame} className="relative h-full min-h-0 bg-page">
      <div className={cx('grid h-full min-h-0', narrow ? 'grid-cols-1' : 'grid-cols-[minmax(250px,290px)_minmax(0,1fr)]')}>
        {!paneOnly && (
          <div className={cx('flex min-h-0 min-w-0 flex-col', narrow ? 'pop-back bg-page' : 'border-r border-line bg-side')}>
            {listOnly && <Banners conn={conn} />}
            <Sidebar s={s} selected={key} conn={conn} onRefresh={refreshAll} onReload={reload} below={listOnly ? <InboxBar s={s} active={null} inline /> : undefined} />
          </div>
        )}
        {!listOnly && (
          <main ref={main} key={narrow ? key : undefined} className={cx('@container/main min-h-0 min-w-0 overflow-y-auto [scrollbar-width:thin]', paneOnly && 'push-in')}>
            <InboxBar s={s} active={activeTab} />
            <Banners conn={conn} />
            {shown ? <MainPane route={shown} s={s} ws={ws} conn={conn} /> : null}
          </main>
        )}
      </div>
      <Toast />
    </div>
  );
}
