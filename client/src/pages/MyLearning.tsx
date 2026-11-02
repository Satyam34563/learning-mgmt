import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatDate, type Bookmark, type Progress } from '../lib/api';
import { Empty, LectureCard, LectureGrid, PageHeader, ProgressBar, Spinner } from '../components/ui';

const TABS = ['Continue watching', 'Bookmarks', 'History'] as const;

export default function MyLearning() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Continue watching');
  const cont = useQuery({ queryKey: ['continue'], queryFn: () => api.get<Progress[]>('/me/continue') });
  const bookmarks = useQuery({ queryKey: ['bookmarks'], queryFn: () => api.get<Bookmark[]>('/me/bookmarks'), enabled: tab === 'Bookmarks' });
  const history = useQuery({ queryKey: ['history'], queryFn: () => api.get<Progress[]>('/me/history'), enabled: tab === 'History' });
  const pct = (p: Progress) => (p.completed ? 1 : p.durationSeconds ? p.positionSeconds / p.durationSeconds : 0);

  return (
    <div>
      <PageHeader title="My learning" />
      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-accent font-semibold text-accent' : 'border-transparent muted hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Continue watching' &&
        (cont.isLoading ? <Spinner /> : !cont.data?.length ? <Empty>Nothing in progress. <Link className="underline" to="/lectures">Browse lectures</Link></Empty> : (
          <LectureGrid>{cont.data.map((p) => <LectureCard key={p._id} lecture={p.lecture} progress={pct(p)} />)}</LectureGrid>
        ))}

      {tab === 'Bookmarks' &&
        (bookmarks.isLoading ? <Spinner /> : !bookmarks.data?.length ? <Empty>No bookmarks yet. Use the bookmark icon on any lecture.</Empty> : (
          <LectureGrid>{bookmarks.data.map((b) => <LectureCard key={b._id} lecture={b.lecture} />)}</LectureGrid>
        ))}

      {tab === 'History' &&
        (history.isLoading ? <Spinner /> : !history.data?.length ? <Empty>You haven't watched anything yet.</Empty> : (
          <table className="table">
            <thead><tr><th>Lecture</th><th className="hidden sm:table-cell">Subject</th><th className="w-28 sm:w-40">Progress</th><th className="hidden sm:table-cell">Last watched</th></tr></thead>
            <tbody>
              {history.data.map((p) => (
                <tr key={p._id}>
                  <td><Link className="hover:underline" to={`/lectures/${p.lecture._id}`}>{p.lecture.title}</Link></td>
                  <td className="hidden muted sm:table-cell">{p.lecture.subject?.name}</td>
                  <td>{p.completed ? <span className="text-xs">✓ Done</span> : <ProgressBar value={pct(p)} />}</td>
                  <td className="hidden muted sm:table-cell">{formatDate(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
}
