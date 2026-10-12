import type {FC} from 'react';

export const ICON_NAMES = ['chart', 'bolt', 'shield', 'users', 'clock', 'link', 'sparkle', 'lock', 'bell', 'layers'] as const;
export type IconName = (typeof ICON_NAMES)[number];

const paths: Record<IconName, string[]> = {
  chart: ['M5 20V11', 'M12 20V4', 'M19 20v-6'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z', 'M9 12l2 2 4-4'],
  users: ['M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6', 'M17 14c2.8 0 5 2 5 5'],
  clock: ['M12 7v5l3 2'],
  link: ['M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1', 'M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'],
  sparkle: ['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z'],
  lock: ['M8 11V8a4 4 0 118 0v3'],
  bell: ['M6 16v-5a6 6 0 1112 0v5l2 2H4l2-2z', 'M10 21a2 2 0 004 0'],
  layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
};

export const Icon: FC<{name: IconName; size: number; color: string; strokeWidth?: number}> = ({name, size, color, strokeWidth = 2}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {paths[name].map((d) => (
      <path key={d} d={d} />
    ))}
    {name === 'users' ? (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
      </>
    ) : null}
    {name === 'clock' ? <circle cx="12" cy="12" r="9" /> : null}
    {name === 'lock' ? <rect x="5" y="11" width="14" height="10" rx="2" /> : null}
  </svg>
);

export const CheckIcon: FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
