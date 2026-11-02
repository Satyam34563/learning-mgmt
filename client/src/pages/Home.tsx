import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, className, type Lecture, type Paged, type Progress } from '../lib/api';
import { useClasses, useMe, useStats, useSubjects } from '../lib/hooks';
import { LectureCard, LectureGrid, SubjectDot } from '../components/ui';

export default function Home() {
  const { data: me } = useMe();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const { data: stats } = useStats();
  const recent = useQuery({
    queryKey: ['lectures', 'recent'],
    queryFn: () => api.get<Paged<Lecture>>('/lectures?sort=recent&limit=6'),
  });
  const cont = useQuery({
    queryKey: ['continue'],
    queryFn: () => api.get<Progress[]>('/me/continue'),
    enabled: !!me,
  });

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl">{me ? `Welcome back, ${me.name.split(' ')[0]}` : 'School lectures'}</h1>
        <p className="mt-2 muted">
          {stats ? `${stats.lectures} lectures across ${stats.classes} classes and ${stats.subjects} subjects.` : ' '}
        </p>
      </section>

      {!!cont.data?.length && (
        <section>
          <SectionTitle title="Continue watching" to="/me" />
          <LectureGrid>
            {cont.data.slice(0, 3).map((p) => (
              <LectureCard key={p._id} lecture={p.lecture} progress={p.durationSeconds ? p.positionSeconds / p.durationSeconds : 0} />
            ))}
          </LectureGrid>
        </section>
      )}

      <section>
        <SectionTitle title="Classes" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {classes?.map((c) => (
            <Link
              key={c._id}
              to={`/classes/${c._id}`}
              className={`card p-4 hover:border-zinc-300 dark:hover:border-zinc-700 ${me?.class === c._id ? 'ring-2 ring-zinc-900 dark:ring-white' : ''}`}
            >
              <div className="font-medium">{className(c)}</div>
              <div className="mt-1 text-xs muted">{stats?.byClass[c._id] ?? 0} lectures</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Subjects" />
        <div className="flex flex-wrap gap-2">
          {subjects?.map((s) => (
            <Link key={s._id} to={`/lectures?subject=${s._id}`} className="btn">
              <SubjectDot color={s.color} />
              {s.name}
              <span className="muted">{stats?.bySubject[s._id] ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Recently added" to="/lectures?sort=recent" />
        <LectureGrid>
          {recent.data?.items.map((l) => <LectureCard key={l._id} lecture={l} />)}
        </LectureGrid>
      </section>
    </div>
  );
}

function SectionTitle({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2>{title}</h2>
      {to && <Link to={to} className="text-sm muted hover:underline">View all</Link>}
    </div>
  );
}
