// Small building blocks shared by every view.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Status } from '../api/types';
import type { Tone } from '../lib/format';
import { linkifyRefs, sourceKind } from '../lib/links';
import { useApp } from '../state/AppContext';

/** Join class names, skipping falsy ones. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const TONES: Record<Tone, string> = {
  red: 'text-red bg-red-soft',
  amber: 'text-amber bg-amber-soft',
  green: 'text-green bg-green-soft',
  grey: 'text-muted bg-grey-soft',
  blue: 'text-blue bg-blue-soft',
  needs: 'text-white bg-needs',
  focus: 'text-focus bg-focus-soft',
};

export function Pill({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx('inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', TONES[tone])}>
      {children}
    </span>
  );
}

const STATUS: Record<Status, [string, Tone]> = { red: ['At risk', 'red'], amber: ['Watch', 'amber'], green: ['On track', 'green'] };

export const StatusPill = ({ status }: { status: Status }) => <Pill tone={STATUS[status][1]}>{STATUS[status][0]}</Pill>;

export const NeedsPill = ({ n }: { n: number }) => (n ? <Pill tone="needs">Needs you · {n}</Pill> : null);

export function RefTag({ ref_, onClick, title }: { ref_: number | null; onClick?: () => void; title?: string }) {
  if (!ref_) return null;
  return (
    <span
      onClick={onClick}
      title={title ?? 'Use this to refer to the workstream in chat'}
      className={cx(
        'mr-1.5 rounded border border-current px-1 py-0.5 align-[2px] font-mono text-[11px] leading-none font-semibold text-muted opacity-80',
        onClick && 'cursor-pointer',
      )}
    >
      W{ref_}
    </span>
  );
}

type Variant = 'default' | 'primary' | 'danger' | 'focus';
const VARIANTS: Record<Variant, string> = {
  default: 'border-line bg-raise text-ink hover:border-muted',
  primary: 'border-blue bg-blue text-white',
  danger: 'border-red bg-red text-white',
  focus: 'border-focus bg-focus-soft text-focus',
};

export function Button({ variant = 'default', small, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'cursor-pointer rounded-[7px] border font-[inherit] disabled:cursor-default disabled:opacity-50',
        small ? 'px-2 py-0.5 text-xs' : 'px-[11px] py-[5px] text-[13px]',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  );
}

/** Free text with "#123" turned into links to the configured repository. */
export function Linkified({ text }: { text: string }) {
  const { repo } = useApp();
  return (
    <>
      {linkifyRefs(text, repo).map((s, i) =>
        typeof s === 'string' ? s : <ExtLink key={i} href={s.href}>{s.label}</ExtLink>,
      )}
    </>
  );
}

/** An item's text, linked to its source, with a tag saying what kind of source; flagged when it has no link. */
export function ItemText({ text, url }: { text: string; url: string | null }) {
  if (!url)
    return (
      <>
        <Linkified text={text} />{' '}
        <span className="text-[11px] whitespace-nowrap text-amber" title="No link to the source yet">no link</span>
      </>
    );
  return (
    <>
      <ExtLink
        href={url}
        className="text-ink underline decoration-line underline-offset-3 hover:text-blue hover:decoration-blue hover:no-underline"
      >
        {text}
      </ExtLink>{' '}
      <span className="text-[11px] whitespace-nowrap text-blue">{sourceKind(url)} ↗</span>
    </>
  );
}

export function SectionTitle({ children, count, action }: { children: ReactNode; count?: ReactNode; action?: ReactNode }) {
  return (
    <h2 className="mt-[30px] mb-2.5 flex items-baseline gap-2 text-[15px] font-semibold">
      {children}
      {count != null && <span className="text-[13px] font-normal text-muted">{count}</span>}
      {action && <span className="ml-auto">{action}</span>}
    </h2>
  );
}

/** A bordered list of rows, separated by lines. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-[10px] border border-line px-3.5 py-0.5 [&>*+*]:border-t [&>*+*]:border-line', className)}>{children}</div>;
}

export const Meta = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('mt-px text-xs text-muted', className)}>{children}</div>
);

export const Empty = ({ children }: { children: ReactNode }) => <div className="py-[18px] text-muted">{children}</div>;
