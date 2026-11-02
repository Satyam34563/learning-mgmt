import { useState } from 'react';
import { useSchool } from '../lib/hooks';

/** The school's logo from the SMS, or the school's initials when there isn't one (or it fails to load). */
export default function SchoolLogo({ className = 'size-7' }: { className?: string }) {
  const { data: school } = useSchool();
  const [failed, setFailed] = useState(false);

  if (school?.logo_url && !failed) {
    return <img src={school.logo_url} alt={school.name ?? 'School logo'} className={`${className} shrink-0 object-contain`} onError={() => setFailed(true)} />;
  }
  const initials = (school?.short_name || school?.name || 'L').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
  return (
    <span className={`${className} grid shrink-0 place-items-center font-serif font-bold tracking-wide text-navy`} aria-label={school?.name ?? 'Lectures'}>
      {initials}
    </span>
  );
}

/**
 * The logo in a white disc ringed navy then gold, with a warm glow: the crest from the SMS login.
 * `size` is the disc's pixel size; rings scale with it.
 */
export function Crest({ size = 136, glow = true }: { size?: number; glow?: boolean }) {
  const ring = Math.max(2, Math.round(size / 27));
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        boxShadow: [
          `0 0 0 ${ring}px #1f3a6e`,
          `0 0 0 ${ring + Math.max(1, Math.round(ring / 2))}px #e3a82b`,
          glow ? `0 0 ${size * 0.45}px ${size * 0.09}px rgb(227 168 43 / 0.22)` : '',
          glow ? `0 ${size * 0.15}px ${size * 0.3}px rgb(0 0 0 / 0.35)` : '',
        ].filter(Boolean).join(', '),
      }}
    >
      <SchoolLogo className="size-[86%]" />
    </span>
  );
}
