// The frame of whatever the main pane shows: a back link on a narrow pane, the header, the content.
import type { ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { Icon } from './icons';

export function Pane({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1040px] px-[clamp(16px,4cqi,36px)] pt-[22px] pb-10">{children}</div>;
}

/** "‹ Your Work", only when the list and the pane are two screens. */
export function BackLink() {
  const { navigate, narrow } = useApp();
  if (!narrow) return null;
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        navigate({ view: 'dash' });
      }}
      className="-mt-1.5 mb-2.5 -ml-1.5 inline-flex items-center gap-px rounded-lg px-1.5 py-1 text-[15px] text-blue hover:no-underline"
    >
      <Icon name="back" width={2.2} className="size-5" />
      Your Work
    </a>
  );
}

/** A pane's header: its tile, a line above the title, the title, a line below, and actions on the right. */
export function PaneHeader({ tile, kicker, title, sub, actions }: { tile: ReactNode; kicker?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rise mb-5 flex flex-wrap items-start gap-x-4 gap-y-3.5">
      {tile}
      <div className="min-w-0 flex-[1_1_260px]">
        {kicker && <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">{kicker}</div>}
        <h2 className="mt-[3px] mb-1 font-display text-[clamp(24px,4.2cqi,32px)] leading-[1.14] font-bold tracking-[-0.026em] [text-wrap:balance]">{title}</h2>
        {sub && <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{actions}</div>}
    </header>
  );
}
