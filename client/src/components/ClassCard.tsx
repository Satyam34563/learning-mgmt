import { Link } from 'react-router-dom';
import { className as classLabel, type SchoolClass } from '../lib/api';
import { Doodle, doodlesForGrade } from './Doodles';

/** Where the six doodles sit on the card: [position + size, rotation, colour]. */
const SLOTS = [
  'right-3 top-2.5 size-11 rotate-12 text-gold/70',
  'right-16 bottom-2 size-6 -rotate-12 text-white/25',
  'right-4 bottom-8 size-8 rotate-6 text-white/35',
  'left-[48%] top-3 size-6 -rotate-6 text-gold/45',
  'left-[30%] bottom-1.5 size-5 rotate-45 text-white/20',
  'right-[40%] bottom-9 size-4 rotate-12 text-gold/40',
];

/** "Class 9" -> 9, "Kindergarten"/"UKG"/"Nursery" -> 0 (null if no number at all). */
function gradeOf(c: SchoolClass): number | null {
  const n = c.name.match(/\d+/);
  if (n) return Number(n[0]);
  return /k\.?g|kinder|nursery|pre|lkg|ukg/i.test(c.name) ? 0 : null;
}

/** The big label on the card: the class number, "KG" for kindergarten, else the initials. */
function badgeOf(c: SchoolClass, grade: number | null) {
  if (grade && grade > 0) return String(grade);
  if (grade === 0) return 'KG';
  return c.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

export default function ClassCard({ cls, lectures, mine }: { cls: SchoolClass; lectures: number; mine?: boolean }) {
  const grade = gradeOf(cls);
  const doodles = doodlesForGrade(grade);
  // rotate the set per class so neighbouring cards don't look identical
  const shift = (grade ?? cls.name.length) % doodles.length;
  const ordered = [...doodles.slice(shift), ...doodles.slice(0, shift)];

  return (
    <Link
      to={`/classes/${cls._id}`}
      className={`school-band group relative isolate flex h-30 flex-col justify-between overflow-hidden rounded-2xl px-4 py-3 text-white shadow-[0_8px_24px_rgb(16_28_56/0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgb(16_28_56/0.28)] focus-visible:-translate-y-1 ${
        mine ? 'ring-2 ring-gold ring-offset-2 ring-offset-page' : ''
      }`}
    >
      {/* thin gold inner frame, as on the login page */}
      <span className="pointer-events-none absolute inset-1.5 -z-10 rounded-[13px] border border-gold/25" />
      {ordered.map((name, i) => (
        <Doodle
          key={name}
          name={name}
          className={`pointer-events-none absolute -z-10 transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:rotate-[20deg] ${SLOTS[i]}`}
        />
      ))}

      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-gold-soft uppercase">
          Class
        </span>
        {mine && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-navy-deep uppercase">Your class</span>}
      </div>

      <div>
        <div className="font-serif text-4xl leading-none font-bold drop-shadow-[0_2px_6px_rgb(0_0_0/0.25)]">
          {badgeOf(cls, grade)}
          {cls.section && <span className="ml-1 text-xl text-gold-soft">{cls.section}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/80">
          <span>{lectures.toLocaleString()} lecture{lectures === 1 ? '' : 's'}</span>
          <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full bg-white/10 text-[11px] transition group-hover:bg-gold group-hover:text-navy-deep" aria-hidden>
            →
          </span>
        </div>
      </div>
      <span className="sr-only">{classLabel(cls)}</span>
    </Link>
  );
}
