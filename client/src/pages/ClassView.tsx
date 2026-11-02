import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, className, type Lecture, type Paged } from '../lib/api';
import { useChapters, useClasses, useSubjects } from '../lib/hooks';
import { Empty, PageHeader, Spinner, SubjectDot } from '../components/ui';

/** Class → Subject → Chapter → Lectures drill-down. */
export default function ClassView() {
  const { classId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subject') ?? '';
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const cls = classes?.find((c) => c._id === classId);

  // One request for every lecture in the class keeps counts and grouping simple (classes are small).
  const { data, isLoading } = useQuery({
    queryKey: ['lectures', 'class', classId],
    queryFn: () => api.get<Paged<Lecture>>(`/lectures?class=${classId}&sort=timetable&limit=100`),
  });
  const { data: chapters } = useChapters({ class: classId, ...(subjectId && { subject: subjectId }) });

  const lectures = data?.items ?? [];
  const countBySubject = lectures.reduce<Record<string, number>>((acc, l) => ((acc[l.subject._id] = (acc[l.subject._id] ?? 0) + 1), acc), {});
  const subjectList = subjects?.filter((s) => countBySubject[s._id] || chapters?.some((c) => (typeof c.subject === 'string' ? c.subject : c.subject._id) === s._id));
  const inSubject = lectures.filter((l) => l.subject._id === subjectId);

  return (
    <div>
      <nav className="mb-2 text-sm muted">
        <Link to="/" className="hover:underline">Home</Link> / {cls ? className(cls) : '…'}
      </nav>
      <PageHeader title={cls ? className(cls) : ' '} subtitle={`${lectures.length} lectures`} actions={<Link className="btn" to={`/timetable?class=${classId}`}>Timetable</Link>} />

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="flex flex-row flex-wrap gap-1 md:flex-col">
          {subjectList?.map((s) => (
            <button
              key={s._id}
              onClick={() => setParams({ subject: s._id })}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${s._id === subjectId ? 'bg-zinc-100 font-medium dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
            >
              <SubjectDot color={s.color} />
              {s.name}
              <span className="ml-auto muted">{countBySubject[s._id] ?? 0}</span>
            </button>
          ))}
        </aside>

        <div>
          {isLoading ? (
            <Spinner />
          ) : !subjectId ? (
            <Empty>Pick a subject to see its chapters and lectures.</Empty>
          ) : (
            <div className="space-y-6">
              {chapters?.map((ch) => {
                const items = inSubject.filter((l) => l.chapter?._id === ch._id);
                return (
                  <section key={ch._id}>
                    <h3 className="mb-2 text-sm font-medium">
                      <span className="muted">Chapter {ch.number} · </span>{ch.title}
                    </h3>
                    {items.length ? <LectureList items={items} /> : <p className="text-sm muted">No lectures yet.</p>}
                  </section>
                );
              })}
              {inSubject.some((l) => !l.chapter) && (
                <section>
                  <h3 className="mb-2 text-sm font-medium muted">Other</h3>
                  <LectureList items={inSubject.filter((l) => !l.chapter)} />
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LectureList({ items }: { items: Lecture[] }) {
  return (
    <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
      {items.map((l) => (
        <li key={l._id}>
          <Link to={`/lectures/${l._id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg viewBox="0 0 16 16" className="size-3" fill="currentColor"><path d="M5 3.5v9l7-4.5z" /></svg>
            </span>
            <span className="flex-1 truncate">{l.title}</span>
            <span className="hidden muted sm:inline">{l.teacher?.name}</span>
            {l.durationMinutes && <span className="muted">{l.durationMinutes} min</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
