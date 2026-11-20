// Line icons, drawn on a 24px grid in the current text colour.
import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  back: <path d="M15 5l-7 7 7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  star: <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />,
  tray: (
    <>
      <path d="M4 13.5l2.2-7.5h11.6l2.2 7.5V19H4z" />
      <path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  loop: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19.5 9M19.5 4.5V9H15" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4.5 15M4.5 19.5V15H9" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-.7c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5z" />
    </>
  ),
  spark: (
    <>
      <path d="M12 4l1.8 4.6L18.5 10l-4.7 1.6L12 16l-1.8-4.4L5.5 10l4.7-1.4z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  done: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3l2.8 2.8L16.5 9.5" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
  // timeline kinds
  meeting: (
    <>
      <circle cx="8.5" cy="9" r="2.8" />
      <circle cx="16" cy="9.5" r="2.4" />
      <path d="M3.5 18.5c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3M14.5 14.4c2.6-.4 4.9.9 5.6 4.1" />
    </>
  ),
  message: <path d="M5 6h14v9.5H11l-4 3.2v-3.2H5z" />,
  doc: (
    <>
      <path d="M7 3.5h7l4 4V20.5H7z" />
      <path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  milestone: <path d="M6 21V4.5M6 4.5h11l-2.2 4 2.2 4H6" />,
  risk: <path d="M12 7.5v6M12 16.8v.2" />,
  pr: (
    <>
      <circle cx="7" cy="6" r="2.2" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="18" r="2.2" />
      <path d="M7 8.2v7.6M17 15.8V10a3 3 0 0 0-3-3h-3.5M12.5 4.8L10.5 7l2 2.2" />
    </>
  ),
  ticket: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  release: (
    <>
      <path d="M4.5 12.5l7-7.5h7.5v7.5l-7.5 7z" />
      <circle cx="15.3" cy="8.7" r="1.3" />
    </>
  ),
  update: <path d="M12 6v12M6 12h12" />,
};

export type IconName = keyof typeof P;

export function Icon({ name, width = 1.8, className }: { name: IconName; width?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'size-4'}
    >
      {P[name]}
    </svg>
  );
}
