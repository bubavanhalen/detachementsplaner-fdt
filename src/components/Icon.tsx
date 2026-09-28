// Hand-drawn 24px stroke icons. Bundled inline so the offline build needs no icon font or CDN.
const paths = {
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  users:
    'M16 20v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 18.5V20M10 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM20 20v-1.5a3.5 3.5 0 00-2.5-3.35M15.5 4.6a3.5 3.5 0 010 6.8',
  user: 'M19 20v-1.5a4 4 0 00-4-4H9a4 4 0 00-4 4V20M12 11a4 4 0 100-8 4 4 0 000 8z',
  upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3',
  file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5',
  sheet:
    'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M8.5 12.5h7M8.5 16h7M12 11v7',
  archive: 'M4 5h16v4H4zM5.5 9v9a2 2 0 002 2h9a2 2 0 002-2V9M10 13h4',
  board:
    'M4 5a1 1 0 011-1h5v7H4zM14 4h5a1 1 0 011 1v4h-6zM14 13h6v6a1 1 0 01-1 1h-5zM4 15h6v5H5a1 1 0 01-1-1z',
  link: 'M10 14a4.5 4.5 0 006.4 0l2.8-2.8a4.5 4.5 0 00-6.4-6.4L11.5 6M14 10a4.5 4.5 0 00-6.4 0l-2.8 2.8a4.5 4.5 0 006.4 6.4l1.3-1.2',
  unlink: 'M9 15l-1.3 1.3a3 3 0 01-4.2-4.2L6 9.5M15 9l1.3-1.3a3 3 0 00-4.2-4.2L9.5 6M4 4l16 16',
  alert:
    'M12 9v4M12 16.5v.01M10.3 4.1L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.1a2 2 0 00-3.4 0z',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.01',
  circle: 'M12 20a8 8 0 100-16 8 8 0 000 16z',
  checkCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12.5l2.8 2.8L16 10',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  monitor: 'M4 5h16v11H4zM9 20h6M12 16v4',
  sidebar: 'M4 5h16v14H4zM9.5 5v14',
  copy: 'M9 9h10v11H9zM5 15V5a1 1 0 011-1h9',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  filter: 'M4 5h16l-6 7.5V19l-4 1.5v-8z',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3.5v4M15 3.5v4',
  pin: 'M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0113 0c0 5.3-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  fit: 'M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4',
  layout: 'M4 4h6v6H4zM14 4h6v6h-6zM9 17h6M4 14h6v6H4zM14 14h6v6h-6z',
  map: 'M9 4L3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20',
  shield: 'M12 21s7.5-3.2 7.5-10V5.5L12 3 4.5 5.5V11c0 6.8 7.5 10 7.5 10zM9 12l2.2 2.2L15.5 10',
  folder: 'M3.5 7a2 2 0 012-2h4l2 2.5h7a2 2 0 012 2V17a2 2 0 01-2 2h-13a2 2 0 01-2-2z',
  printer:
    'M7 9V4h10v5M7 17H5a1.5 1.5 0 01-1.5-1.5V10.5A1.5 1.5 0 015 9h14a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0119 17h-2M7 14h10v6H7z',
  sparkle:
    'M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.9zM18.5 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  send: 'M5 12h14M13 6l6 6-6 6',
  duplicate: 'M8 8h11v11H8zM5 16V6a1 1 0 011-1h10',
  move: 'M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
  contact: 'M5 4h14v16H5zM12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8.5 16.5a3.5 3.5 0 017 0',
  command: 'M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 103 3z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  map2: 'M12 21a9 9 0 100-18 9 9 0 000 18z',
} as const;

export type IconName = keyof typeof paths;
// Dot-based glyphs need a heavier stroke to read as dots.
const bold = new Set<IconName>(['more', 'grip']);

export function Icon({
  name,
  size = 18,
  className,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={bold.has(name) ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
