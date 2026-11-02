import { useState } from 'react';
import { useSchool } from '../lib/hooks';

/** The school's logo from the SMS, or a neutral play mark when there isn't one (or it fails to load). */
export default function SchoolLogo({ className = 'size-7' }: { className?: string }) {
  const { data: school } = useSchool();
  const [failed, setFailed] = useState(false);

  if (school?.logo_url && !failed) {
    return <img src={school.logo_url} alt={school.name ?? 'School logo'} className={`${className} shrink-0 object-contain`} onError={() => setFailed(true)} />;
  }
  return (
    <span className={`${className} grid shrink-0 place-items-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}>
      <svg viewBox="0 0 16 16" className="size-1/2" fill="currentColor"><path d="M5 3.5v9l7-4.5z" /></svg>
    </span>
  );
}
