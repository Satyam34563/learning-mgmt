import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, className, type SchoolClass, type Subject } from '../lib/api';
import { useStats } from '../lib/hooks';
import { PageHeader, Spinner, SubjectDot } from '../components/ui';

interface AnalyticsData {
  topLectures: { _id: string; title: string; views: number; subject: Subject; classes: SchoolClass[] }[];
  byTeacher: { _id: string | null; name: string; lectures: number; views: number }[];
  completion: { started: number; completed: number };
  activeLearners30d: number;
  lecturesAdded30d: number;
  drafts: number;
  usersByRole: Record<string, number>;
}

export default function Analytics() {
  const { data: stats } = useStats();
  const { data, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: () => api.get<AnalyticsData>('/stats/analytics') });
  if (isLoading || !data) return <Spinner />;

  const completionRate = data.completion.started ? Math.round((data.completion.completed / data.completion.started) * 100) : 0;
  const maxViews = Math.max(1, ...data.topLectures.map((l) => l.views));

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Published lectures" value={stats?.lectures} />
        <Stat label="Added in last 30 days" value={data.lecturesAdded30d} />
        <Stat label="Active learners (30 days)" value={data.activeLearners30d} />
        <Stat label="Completion rate" value={`${completionRate}%`} hint={`${data.completion.completed} of ${data.completion.started} started`} />
        <Stat label="Drafts" value={data.drafts} />
        <Stat label="Students" value={data.usersByRole.student ?? 0} />
        <Stat label="Teachers (accounts)" value={data.usersByRole.teacher ?? 0} />
        <Stat label="Admins" value={data.usersByRole.admin ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-base">Most watched</h2>
          <ol className="space-y-3">
            {data.topLectures.map((l) => (
              <li key={l._id} className="text-sm">
                <div className="flex items-center gap-2">
                  <SubjectDot color={l.subject?.color} />
                  <Link to={`/lectures/${l._id}`} className="flex-1 truncate hover:underline">{l.title}</Link>
                  <span className="tabular-nums muted">{l.views}</span>
                </div>
                <div className="mt-1 ml-4 h-1 rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(l.views / maxViews) * 100}%` }} />
                </div>
                <div className="mt-0.5 ml-4 text-xs muted">{l.classes.map(className).join(', ')}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-base">By teacher</h2>
          <table className="table">
            <thead><tr><th>Teacher</th><th className="text-right">Lectures</th><th className="text-right">Views</th></tr></thead>
            <tbody>
              {data.byTeacher.map((t) => (
                <tr key={t._id ?? 'none'}>
                  <td className={t._id ? '' : 'muted'}>{t.name}</td>
                  <td className="text-right tabular-nums">{t.lectures}</td>
                  <td className="text-right tabular-nums">{t.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to="/manage/gaps" className="mt-4 inline-block text-sm underline">See chapters with no lectures →</Link>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value?: number | string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value ?? '—'}</div>
      {hint && <div className="mt-0.5 text-xs muted">{hint}</div>}
    </div>
  );
}
