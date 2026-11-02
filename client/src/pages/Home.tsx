import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type Lecture, type Paged, type Progress } from '../lib/api';
import { isStaff, useClasses, useMe, useSchool, useStats, useSubjects } from '../lib/hooks';
import { Empty, LectureCard, LectureGrid, SubjectDot } from '../components/ui';
import { Crest } from '../components/SchoolLogo';
import ClassCard from '../components/ClassCard';

export default function Home() {
  const { data: me } = useMe();
  const { data: school } = useSchool();
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
      {/* Navy banner like the SMS login: building photo under a navy wash, crest, greeting, counts */}
      <section className="school-band relative isolate overflow-hidden rounded-2xl px-6 py-8 text-white shadow-[0_12px_36px_rgb(16_28_56/0.18)] sm:px-10 sm:py-10">
        {school?.building_url && (
          <>
            <img src={school.building_url} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
            <div className="school-band absolute inset-0 -z-10 opacity-[0.88]" />
          </>
        )}
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-gold/30" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Crest size={84} />
          <div className="min-w-0">
            {school?.name && (
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-soft uppercase">{school.name}</p>
            )}
            <h1 className="mt-1 text-3xl text-white sm:text-4xl">
              {me ? `Welcome back, ${me.name.split(' ')[0]}` : 'Lectures'}
            </h1>
            <p className="mt-2 text-white/75">
              {stats
                ? `${stats.lectures} lectures across ${stats.classes} classes and ${stats.subjects} subjects.`
                : ' '}
            </p>
          </div>
          <Link to="/lectures" className="btn-base border-gold bg-gold text-navy-deep hover:bg-gold-soft sm:ml-auto">
            Browse lectures
          </Link>
        </div>
      </section>

      {!!cont.data?.length && (
        <section>
          <SectionTitle title="Continue watching" to="/me" />
          <LectureGrid>
            {cont.data.slice(0, 3).map((p) => (
              <LectureCard
                key={p._id}
                lecture={p.lecture}
                progress={p.durationSeconds ? p.positionSeconds / p.durationSeconds : 0}
              />
            ))}
          </LectureGrid>
        </section>
      )}

      {/* A school that hasn't added anything yet: one clear note instead of empty sections */}
      {classes && subjects && recent.data && !classes.length && !subjects.length && !recent.data.items.length && (
        <Empty>
          {isStaff(me) ? (
            <>
              No lectures yet. Start by adding the school's{' '}
              <Link className="link" to="/manage/catalog">
                classes, subjects and chapters
              </Link>
              , then{' '}
              <Link className="link" to="/manage/lectures/new">
                add a lecture
              </Link>{' '}
              or{' '}
              <Link className="link" to="/manage/import">
                import many at once
              </Link>
              .
            </>
          ) : (
            'No lectures have been added yet. They will appear here as soon as the school adds them.'
          )}
        </Empty>
      )}

      {!!classes?.length && (
        <section>
          <SectionTitle title="Classes" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {classes.map((c) => (
              <ClassCard key={c._id} cls={c} lectures={stats?.byClass[c._id] ?? 0} mine={me?.class === c._id} />
            ))}
          </div>
        </section>
      )}

      {!!subjects?.length && (
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
      )}

      {!!recent.data?.items.length && (
        <section>
          <SectionTitle title="Recently added" to="/lectures?sort=recent" />
          <LectureGrid>
            {recent.data.items.map((l) => (
              <LectureCard key={l._id} lecture={l} />
            ))}
          </LectureGrid>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2>{title}</h2>
      {to && (
        <Link to={to} className="text-sm muted hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}
