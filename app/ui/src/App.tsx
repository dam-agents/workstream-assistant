// The shell: header, connection state, banners, and the current view.
import type { ReactNode } from 'react';
import { Button, cx } from './components/ui';
import { Dashboard } from './features/dashboard/Dashboard';
import { WorkstreamPage } from './features/workstream/WorkstreamPage';
import { wsRef } from './lib/workstreams';
import { useApp, type NoticeKind } from './state/AppContext';
import { usePrompt } from './state/useAction';
import { useViewData, type Connection } from './state/useViewData';

const BANNER: Record<NoticeKind, string> = {
  warn: 'bg-amber-soft text-amber',
  err: 'bg-red-soft text-red',
  ok: 'bg-green-soft text-green',
};

function Banner({ kind, children }: { kind: NoticeKind; children: ReactNode }) {
  return <div className={cx('mt-3.5 flex flex-wrap items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px]', BANNER[kind])}>{children}</div>;
}

function ConnDot({ conn }: { conn: Connection }) {
  const label = conn.state === 'live' ? 'Live' : conn.state === 'snapshot' ? 'Snapshot' : 'Loading…';
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className={cx('size-2 rounded-full', conn.state === 'live' ? 'bg-green' : conn.state === 'snapshot' ? 'bg-amber' : 'bg-muted')} />
      {label}
    </span>
  );
}

export function App() {
  const { navigate, notice, reload } = useApp();
  const { view, conn } = useViewData();
  const prompt = usePrompt();
  const ws = view?.view === 'ws' ? view.data : null;

  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-5 pb-16">
      <header className="flex flex-wrap items-center gap-3 border-b border-line pb-3.5">
        <h1 className="m-0 cursor-pointer text-xl font-semibold tracking-[-.01em]" onClick={() => navigate({ view: 'dash' })}>
          Workstreams
        </h1>
        {ws && <span className="text-muted">› {ws.ref ? `W${ws.ref} · ` : ''}{ws.name}</span>}
        <span className="flex-1" />
        <ConnDot conn={conn} />
        <Button onClick={reload}>Reload</Button>
        <Button
          onClick={() =>
            prompt(
              `Refresh ${ws ? `workstream "${wsRef(ws)}"` : 'all workstreams'} in the Workstreams app: sweep the sources since the last update, add new progress, close finished asks and follow-ups, and tell me what changed.`,
              '',
            )
          }
        >
          Ask agent to refresh
        </Button>
      </header>

      {conn.stale && (
        <Banner kind="warn">
          This page is out of date: the app was updated since it was published, so some sections may be missing.
          <Button onClick={() => prompt('The Workstreams page is out of date. Rebuild and republish it (app/README.md, Publishing).', '')}>
            Ask agent to republish
          </Button>
        </Banner>
      )}
      {conn.offline && (
        <Banner kind="warn">
          {conn.offline} <Button onClick={reload}>Retry</Button>
        </Banner>
      )}
      {notice && <Banner kind={notice.kind}>{notice.text}</Banner>}

      <main>
        {!view ? (
          <div className="py-[60px] text-center text-muted">{conn.state === 'loading' ? 'Loading…' : 'Nothing here.'}</div>
        ) : view.view === 'ws' ? (
          <WorkstreamPage ws={view.data} />
        ) : (
          <Dashboard s={view.data} />
        )}
      </main>
    </div>
  );
}
