import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, className, type Chapter, type SchoolClass, type Subject } from '../../lib/api';
import { Empty, PageHeader, Spinner, SubjectDot } from '../../components/ui';

type GapChapter = Chapter & { subject: Subject; classes: SchoolClass[] };

/** Chapters with no published lecture yet. */
export default function Gaps() {
  const { data, isLoading } = useQuery({ queryKey: ['gaps'], queryFn: () => api.get<GapChapter[]>('/stats/gaps') });
  const bySubject = Object.values(
    (data ?? []).reduce<Record<string, { subject: Subject; chapters: GapChapter[] }>>((acc, c) => {
      (acc[c.subject._id] ??= { subject: c.subject, chapters: [] }).chapters.push(c);
      return acc;
    }, {}),
  );

  return (
    <div>
      <PageHeader title="Missing lectures" subtitle={data && `${data.length} chapter${data.length === 1 ? '' : 's'} have no published lecture yet.`} />
      {isLoading ? <Spinner /> : !data?.length ? <Empty>Every chapter has at least one lecture.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {bySubject.map(({ subject, chapters }) => (
            <section key={subject._id} className="card min-w-0 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-base"><SubjectDot color={subject.color} />{subject.name}</h2>
              <ul className="space-y-1 text-sm">
                {chapters.map((c) => (
                  <li key={c._id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{c.number}. {c.title}</span>
                    <span className="shrink-0 text-xs muted">{c.classes.map(className).join(', ')}</span>
                    <Link className="text-xs underline" to="/manage/lectures/new">Add</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
