/**
 * Hand-drawn-style line doodles (48×48, stroke only) for decorating cards. They take `currentColor`,
 * so the parent sets the colour; size and position come from className.
 */
import type { ReactNode } from 'react';

const ellipse = (rotate: number) => <ellipse cx="24" cy="24" rx="19" ry="7" transform={`rotate(${rotate} 24 24)`} />;

const PATHS: Record<string, ReactNode> = {
  star: <path d="M24 5l5.5 11.5 12.5 1.5-9.3 8.7 2.5 12.3L24 33l-11.2 6 2.5-12.3L6 18l12.5-1.5z" />,
  pencil: <path d="M9 39l3.5-11.5L33 7l8 8-20.5 20.5zM12.5 27.5l8 8M29 11l8 8M9 39l5-1.5" />,
  book: <path d="M7 12c6-3.5 11.5-3.5 17 0v27c-5.5-3.5-11-3.5-17 0zM24 12c5.5-3.5 11-3.5 17 0v27c-6-3.5-11.5-3.5-17 0zM11 18c3-1 6-1 9 .5M11 24c3-1 6-1 9 .5M28 18c3-1.5 6-1.5 9-.5" />,
  apple: <path d="M24 15c-6-4.5-14-1.5-14 9 0 9.5 6.5 17.5 14 13.5 7.5 4 14-4 14-13.5 0-10.5-8-13.5-14-9zM24 15c-.5-4 1.5-7.5 5-9M24 13c-3-3.5-7.5-3.5-9-1" />,
  abc: <path d="M9 15h26v26H9zM9 15l7-7h26l-7 7M42 8v26l-7 7M17.5 35l4.5-12.5 4.5 12.5M19.5 30.5h5" />,
  balloon: <path d="M24 5c-8.5 0-12.5 6.5-12.5 12.5 0 8.5 7 14 12.5 16.5 5.5-2.5 12.5-8 12.5-16.5C36.5 11.5 32.5 5 24 5zM22 34h4l-2 3zM24 37c-3 3.5 3 5.5 0 10M18 13c1.5-2.5 3.5-3.5 6-3.5" />,
  sun: <path d="M24 17a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.2 4.2M33.3 33.3l4.2 4.2M37.5 10.5l-4.2 4.2M14.7 33.3l-4.2 4.2" />,
  cloud: <path d="M14 34h20a7.5 7.5 0 0 0 .5-15 9.5 9.5 0 0 0-18-2.5A8.5 8.5 0 0 0 14 34z" />,
  plane: <path d="M5 22l37-15-10 35-8.5-12.5zM23.5 29.5L42 7M23.5 29.5l-2 9 5-6" />,
  ruler: <path d="M7 33L33 7l8 8-26 26zM13 27l3.5 3.5M17.5 22.5l5 5M22 18l3.5 3.5M26.5 13.5l5 5" />,
  bulb: <path d="M24 5a11.5 11.5 0 0 0-6.5 21c2 1.5 2.5 3.5 2.5 6h8c0-2.5.5-4.5 2.5-6A11.5 11.5 0 0 0 24 5zM20 36h8M21 40h6M24 32v-8l-3-3M24 24l3-3" />,
  atom: (
    <>
      {ellipse(0)}
      {ellipse(60)}
      {ellipse(120)}
      <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
    </>
  ),
  globe: <path d="M24 7a17 17 0 1 1 0 34 17 17 0 0 1 0-34zM7 24h34M24 7c-7.5 8.5-7.5 25.5 0 34M24 7c7.5 8.5 7.5 25.5 0 34M10 15.5c8.5 3 19.5 3 28 0M10 32.5c8.5-3 19.5-3 28 0" />,
  flask: <path d="M18.5 6h11M21 6v12.5L10 37.5c-1.5 3 .5 4.5 3.5 4.5h21c3 0 5-1.5 3.5-4.5L27 18.5V6M14.5 30h19M22 35h.1M27 33.5h.1" />,
  compass: <path d="M24 5v5M24 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM22.5 15.5L13 42M25.5 15.5L35 42M17 31h14" />,
  cap: <path d="M4 18l20-10 20 10-20 10zM12 22.5V32c4.5 4.5 19.5 4.5 24 0v-9.5M40.5 20v12.5M40.5 32.5l-2 4h4z" />,
  music: <path d="M18 35V11l18-4.5V31M18 35a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM36 31a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM18 17l18-4.5" />,
  heart: <path d="M24 40S8 30.5 8 18.5a8 8 0 0 1 16-2.5 8 8 0 0 1 16 2.5C40 30.5 24 40 24 40z" />,
  squiggle: <path d="M3 30c6-11 10 11 16 0s10 11 16 0 9 11 11 2" />,
  sparkle: <path d="M24 6c1.5 9 4.5 12.5 13 14-8.5 1.5-11.5 5-13 14-1.5-9-4.5-12.5-13-14 8.5-1.5 11.5-5 13-14zM39 33c.5 3 1.5 4 4 4.5-2.5.5-3.5 1.5-4 4.5-.5-3-1.5-4-4-4.5 2.5-.5 3.5-1.5 4-4.5z" />,
  rocket: <path d="M24 4c8.5 6.5 10.5 17 6.5 28h-13C13.5 21 15.5 10.5 24 4zM17.5 32l-6 6.5 6.5-1M30.5 32l6 6.5-6.5-1M24 15.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM21 36c1 3 2 5 3 7 1-2 2-4 3-7" />,
  triangle: <path d="M24 7l17 30H7zM24 17l8 14H16" />,
};

export type DoodleName = keyof typeof PATHS;

export function Doodle({ name, className = '', strokeWidth = 2.2 }: { name: DoodleName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/** Doodles that suit an age group: playful for the youngest, subject-flavoured for the older classes. */
export function doodlesForGrade(grade: number | null): DoodleName[] {
  if (grade === null || grade <= 0) return ['abc', 'balloon', 'star', 'sun', 'heart', 'cloud'];
  if (grade <= 2) return ['pencil', 'apple', 'star', 'music', 'cloud', 'squiggle'];
  if (grade <= 5) return ['book', 'plane', 'ruler', 'bulb', 'star', 'squiggle'];
  if (grade <= 8) return ['globe', 'atom', 'ruler', 'book', 'bulb', 'sparkle'];
  return ['flask', 'compass', 'cap', 'atom', 'rocket', 'sparkle'];
}
