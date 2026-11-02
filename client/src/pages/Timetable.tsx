import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { className, getAllPages, type Lecture } from '../lib/api';
import { useClasses, useMe } from '../lib/hooks';
import { Empty, PageHeader, Spinner, SubjectDot } from '../components/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

function mondayOf(dateStr?: string | null) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/** Week view of lectures by date and period, e.g. "yesterday's Class 9 lectures". */
export default function Timetable() {
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const { data: classes } = useClasses();
  const classId = params.get('class') ?? '';
  const monday = mondayOf(params.get('week'));
  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);

  // Students land on their own class.
  useEffect(() => {
    if (!classId && me?.class) setParams((p) => (p.set('class', me.class!), p), { replace: true });
  }, [classId, me?.class, setParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['timetable', classId, iso(monday)],
    queryFn: () =>
      getAllPages<Lecture>('/lectures', { class: classId, from: iso(monday), to: `${iso(saturday)}T23:59:59Z`, sort: 'timetable' }),
    enabled: !!classId,
  });

  const shiftWeek = (weeks: number) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + weeks * 7);
    setParams((p) => (p.set('week', iso(d)), p));
  };

  const lectures = data?.items ?? [];
  const periods = Math.max(6, ...lectures.map((l) => l.period ?? 0));
  const cell = (day: number, period: number) =>
    lectures.filter((l) => {
      if (!l.lectureDate) return false;
      const d = new Date(l.lectureDate);
      return (d.getUTCDay() + 6) % 7 === day && (l.period ?? 0) === period;
    });
  const unscheduled = lectures.filter((l) => !l.period);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={`Week of ${fmt(monday)} – ${fmt(saturday)}`}
        actions={
          <>
            <select className="input w-auto" value={classId} onChange={(e) => setParams((p) => (p.set('class', e.target.value), p))}>
              <option value="">Choose class…</option>
              {classes?.map((c) => <option key={c._id} value={c._id}>{className(c)}</option>)}
            </select>
            <button className="btn" onClick={() => shiftWeek(-1)} aria-label="Previous week">←</button>
            <button className="btn" onClick={() => setParams((p) => (p.delete('week'), p))}>This week</button>
            <button className="btn" onClick={() => shiftWeek(1)} aria-label="Next week">→</button>
          </>
        }
      />
      {!classId ? (
        <Empty>Choose a class to see its week.</Empty>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-14" />
                  {DAYS.map((d, i) => {
                    const date = new Date(monday);
                    date.setUTCDate(monday.getUTCDate() + i);
                    const today = iso(date) === iso(new Date());
                    return (
                      <th key={d} className={`px-2 pb-2 text-left text-xs font-medium ${today ? '' : 'muted'}`}>
                        {d} <span className="font-normal">{fmt(date)}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: periods }, (_, p) => (
                  <tr key={p}>
                    <td className="border-t border-line py-2 pr-2 align-top text-xs muted">P{p + 1}</td>
                    {DAYS.map((_, day) => (
                      <td key={day} className="border-t border-line p-1 align-top">
                        {cell(day, p + 1).map((l) => (
                          <Link key={l._id} to={`/lectures/${l._id}`} className="mb-1 block rounded-md border border-line bg-card p-2 hover:border-accent/40">
                            <div className="flex items-center gap-1.5 text-xs muted"><SubjectDot color={l.subject.color} />{l.subject.name}</div>
                            <div className="mt-0.5 line-clamp-2 text-xs font-medium">{l.title}</div>
                          </Link>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lectures.length && <p className="mt-4 text-sm muted">No lectures scheduled this week.</p>}
          {unscheduled.length > 0 && (
            <p className="mt-4 text-sm muted">
              {unscheduled.length} lecture(s) this week have no period set:{' '}
              {unscheduled.map((l, i) => <span key={l._id}>{i > 0 && ', '}<Link className="underline" to={`/lectures/${l._id}`}>{l.title}</Link></span>)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
