// Small building blocks shared by every view.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { Status } from '../api/types';
import type { Tone } from '../lib/format';
import { linkifyRefs, sourceKind } from '../lib/links';
import { accentOf, initials } from '../lib/workstreams';
import { useApp } from '../state/AppContext';
import { Icon, type IconName } from './icons';

/** Join class names, skipping falsy ones. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const TONES: Record<Tone, [string, string]> = {
  // text and background, dot
  red: ['text-red bg-red-soft', 'bg-red-dot'],
  amber: ['text-amber bg-amber-soft', 'bg-amber-dot'],
  green: ['text-green bg-green-soft', 'bg-green-dot'],
  grey: ['text-muted bg-grey-soft', 'bg-grey-dot'],
  blue: ['text-blue bg-blue-soft', 'bg-blue'],
  needs: ['text-white bg-blue', 'bg-white'],
  focus: ['text-focus bg-amber-soft', 'bg-star'],
};

/** A rounded label; with `dot`, a status dot in front. */
export function Pill({ tone, children, title, dot, small }: { tone: Tone; children: ReactNode; title?: string; dot?: boolean; small?: boolean }) {
  return (
    <span
      title={title}
      data-pill
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-normal whitespace-nowrap',
        small ? 'py-px pr-[7px] pl-1.5 text-[11px]' : 'py-0.5 pr-[9px] pl-2 text-xs',
        !dot && (small ? 'pl-[7px]' : 'pl-[9px]'),
        TONES[tone][0],
      )}
    >
      {dot && <i data-dot className={cx('size-1.5 flex-none rounded-full', TONES[tone][1])} />}
      {children}
    </span>
  );
}

export const STATUS: Record<Status, [string, Tone]> = { red: ['At risk', 'red'], amber: ['Watch', 'amber'], green: ['On track', 'green'] };

export const StatusPill = ({ status, small }: { status: Status; small?: boolean }) => (
  <Pill tone={STATUS[status][1]} dot small={small}>
    {STATUS[status][0]}
  </Pill>
);

/** A workstream's coloured tile with its ref, e.g. "W3"; or an icon, for the inbox rows. */
export function Tile({ ref_, icon, size = 30, title }: { ref_?: number | null; icon?: IconName; size?: number; title?: string }) {
  const style = { '--a': icon ? 'var(--wsa-accent-none)' : accentOf(ref_), width: size, height: size, borderRadius: size * 0.27, fontSize: size * 0.36 } as CSSProperties;
  return (
    <span
      title={title}
      style={style}
      className="inline-grid flex-none place-items-center bg-[linear-gradient(180deg,color-mix(in_srgb,var(--a)_74%,#fff),var(--a))] font-bold tracking-[-0.01em] text-white tabular-nums shadow-[inset_0_0_0_.5px_rgba(0,0,0,.08)]"
    >
      {icon ? <Icon name={icon} width={1.9} className="size-[56%]" /> : ref_ ? `W${ref_}` : '·'}
    </span>
  );
}

/** A person's initials in a circle; the owner in blue. */
export function Avatar({ name, me, size = 24, title }: { name: string; me?: boolean; size?: number; title?: string }) {
  return (
    <span
      title={title ?? name}
      style={{ width: size, height: size, fontSize: size * 0.37 }}
      className={cx(
        'inline-grid flex-none place-items-center rounded-full font-semibold text-white',
        me ? 'bg-[linear-gradient(180deg,#5ac8fa,#007aff)]' : 'bg-[linear-gradient(180deg,#a9aeb9,#868a95)]',
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Avatars({ people, size = 22 }: { people: { name: string; role?: string }[]; size?: number }) {
  if (!people.length) return null;
  return (
    <span className="inline-flex">
      {people.slice(0, 5).map((p, i) => (
        <span key={p.name} className={cx('rounded-full shadow-[0_0_0_2px_var(--wsa-bg)]', i > 0 && '-ml-1.5')}>
          <Avatar name={p.name} size={size} title={p.role ? `${p.name}: ${p.role}` : p.name} />
        </span>
      ))}
    </span>
  );
}

// Primary actions are buttons; everything secondary is a link-styled button ("default"), so one action per place stands out.
type Variant = 'default' | 'primary' | 'danger' | 'star' | 'sent';
const LINK = 'bg-transparent text-blue font-medium hover:underline underline-offset-2 disabled:no-underline';
const VARIANTS: Record<Variant, string> = {
  default: LINK,
  star: LINK,
  primary: 'bg-blue text-white hover:bg-[color-mix(in_srgb,var(--wsa-blue)_88%,#000)]',
  danger: 'bg-red text-white',
  sent: 'bg-blue-soft text-blue cursor-default',
};
const isLink = (v: Variant) => v === 'default' || v === 'star';

export function Button({ variant = 'default', small, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 border-0 whitespace-nowrap disabled:cursor-default disabled:opacity-50',
        isLink(variant)
          ? cx('rounded px-0.5 py-0', small ? 'text-xs' : 'text-[13px]')
          : cx('rounded-lg font-semibold transition-[background,scale] active:scale-[.96] disabled:active:scale-100', small ? 'h-[26px] px-2.5 text-xs' : 'h-[30px] px-3 text-[13px]'),
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function IconButton({ icon, label, onClick, spin, disabled }: { icon: IconName; label: string; onClick: () => void; spin?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-fill2 hover:text-ink disabled:opacity-50"
    >
      <Icon name={icon} width={2} className={cx('size-4', spin && 'animate-[wsa-spin_.9s_var(--ease-ios)]')} />
    </button>
  );
}

/** A white card on the grey page: a title, an optional note beside it, then its content. */
export function Card({ title, sub, action, children, i = 0, className, label }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; i?: number; className?: string; label?: string }) {
  return (
    <section aria-label={label} style={{ '--i': i } as CSSProperties} className={cx('rise min-w-0 rounded-2xl bg-raise px-5 py-[18px] shadow-card', className)}>
      {(title || action) && (
        <h3 className="m-0 mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 text-base font-semibold tracking-[-0.015em]">
          <span className="flex items-baseline gap-2.5">{title}</span>
          {sub != null && <span className="text-[12.5px] font-normal tracking-normal text-muted">{sub}</span>}
          {action}
        </h3>
      )}
      {children}
    </section>
  );
}

/** A segmented control: one of a few options, the thumb slides to the chosen one. */
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="group" aria-label={label} className="relative inline-grid auto-cols-fr grid-flow-col rounded-[9px] bg-fill p-0.5 text-[13px] font-medium tracking-[-0.005em]">
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 rounded-[7px] bg-thumb shadow-[0_1px_3px_rgba(0,0,0,.12),0_0_0_.5px_rgba(0,0,0,.04)] transition-[translate] duration-[380ms] ease-ios"
        style={{ width: `calc((100% - 4px) / ${options.length})`, translate: `${idx * 100}% 0` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('relative z-[1] cursor-pointer rounded-[7px] border-0 bg-transparent px-3 py-1 text-center whitespace-nowrap', o.value === value && 'font-semibold')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The round Done check of a to-do. */
export function Check({ done, onClick, label, disabled }: { done: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      title={disabled ? 'Live data only' : 'Mark done'}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'relative grid size-[22px] flex-none cursor-pointer place-items-center rounded-full border-[1.5px] p-0 transition-[background,border-color] disabled:cursor-default disabled:opacity-60',
        done ? 'border-blue bg-blue' : 'border-faint bg-transparent hover:border-blue',
      )}
    >
      <svg viewBox="0 0 16 16" aria-hidden className={cx('size-3 fill-none stroke-white stroke-[2.6] transition-[opacity,scale] duration-400 ease-spring [stroke-linecap:round] [stroke-linejoin:round]', done ? 'scale-100 opacity-100' : 'scale-30 opacity-0')}>
        <path d="M3.2 8.4l3 3L12.8 4.8" />
      </svg>
      {done && <span aria-hidden className="pointer-events-none absolute -inset-0.5 rounded-full border-2 border-blue opacity-0 animate-[wsa-ring_.55s_var(--ease-ios)]" />}
    </button>
  );
}

/** A workstream as a small chip that opens it. */
export function WsChip({ ref_, name, onClick }: { ref_: number | null; name: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-fill2 py-[3px] pr-2.5 pl-1 text-xs font-medium text-ink transition-colors hover:bg-fill"
    >
      <Tile ref_={ref_} size={18} />
      <span className="max-w-[240px] truncate">{name}</span>
    </button>
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
      <ExtLink href={url} className="text-ink hover:text-blue hover:no-underline">
        {text}
      </ExtLink>{' '}
      <span className="text-[11px] whitespace-nowrap text-faint">{sourceKind(url)} ↗</span>
    </>
  );
}

export const Meta = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('mt-0.5 text-[12.5px] text-muted', className)}>{children}</div>
);

export const Empty = ({ children }: { children: ReactNode }) => <div className="py-3 text-[13.5px] text-muted">{children}</div>;

/** A centered note for a pane with nothing left in it. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rise grid justify-items-center gap-1.5 px-5 py-[60px] text-center text-muted">
      <span className="text-green-dot">
        <Icon name="done" width={1.6} className="size-10" />
      </span>
      <b className="text-[17px] text-ink">{title}</b>
      {children && <span>{children}</span>}
    </div>
  );
}

/** A list of rows separated by hairlines. */
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="m-0 list-none p-0 [&>li+li]:border-t [&>li+li]:border-line">{children}</ul>;
}
