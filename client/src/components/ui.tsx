import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useBookmarks } from '../lib/hooks';
import VideoThumb from './VideoThumb';
import { className, formatDate, type Lecture } from '../lib/api';

export function SubjectDot({ color }: { color?: string }) {
  return <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color ?? '#a1a1aa' }} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm muted">{children}</div>;
}

export function Spinner() {
  return <div className="py-10 text-center text-sm muted">Loading…</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="rounded-md rounded-lg bg-danger-bg px-3.5 py-3 text-sm text-danger-ink">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function BookmarkButton({ id }: { id: string }) {
  const { enabled, ids, toggle } = useBookmarks();
  if (!enabled) return null;
  const on = ids.has(id);
  return (
    <button
      type="button"
      title={on ? 'Remove bookmark' : 'Bookmark'}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        toggle(id, !on);
      }}
      className="rounded p-1 text-muted hover:text-accent"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12v18l-6-4-6 4z" className={on ? 'text-accent' : ''} />
      </svg>
    </button>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-subtle">
      <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.round(value * 100))}%` }} />
    </div>
  );
}

export function LectureCard({ lecture, progress }: { lecture: Lecture; progress?: number }) {
  return (
    <Link to={`/lectures/${lecture._id}`} className="card group flex flex-col overflow-hidden transition hover:border-accent/40">
      <VideoThumb url={lecture.videoUrl} minutes={lecture.durationMinutes} progress={progress} className="transition-opacity group-hover:opacity-90" />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2 text-xs muted">
          <SubjectDot color={lecture.subject?.color} />
          <span className="truncate">{lecture.subject?.name}</span>
          {lecture.chapter && <span className="truncate">· {lecture.chapter.title}</span>}
          {lecture.status === 'draft' && <span className="chip ml-auto">Draft</span>}
          <span className={lecture.status === 'draft' ? '' : 'ml-auto'}>
            <BookmarkButton id={lecture._id} />
          </span>
        </div>
        <h3 className="line-clamp-2 font-medium group-hover:underline">{lecture.title}</h3>
        <p className="mt-1 text-xs muted">{lecture.classes.map(className).join(', ')}</p>
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs muted">
          {lecture.teacher && <span className="truncate">{lecture.teacher.name}</span>}
          {lecture.lectureDate && <span className="ml-auto shrink-0">{formatDate(lecture.lectureDate)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function LectureGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-2 text-sm">
      <button className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}
