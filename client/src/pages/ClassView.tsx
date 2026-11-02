import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, className, qs, type Chapter, type Lecture, type Paged } from '../lib/api';
import { useChapters, useClasses, useSubjects } from '../lib/hooks';
import { Empty, PageHeader, Spinner, SubjectDot } from '../components/ui';
import VideoThumb from '../components/VideoThumb';

interface ClassStats {
  total: number;
  bySubject: Record<string, number>;
  byChapter: Record<string, number>;
}

const PAGE = 50;
const SELF_NUMBERED = /^(chapter|ch\.?|unit|lesson|lec(ture)?)\s*\d+/i;

/**
 * Class → Subject → Chapter → Lectures. Counts come from the server; lectures load one chapter at a time
 * (a class can have thousands), 50 at a time with "Show more".
 */
export default function ClassView() {
  const { classId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const openChapter = params.get('chapter') ?? '';
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const cls = classes?.find((c) => c._id === classId);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['class-stats', classId],
    queryFn: () => api.get<ClassStats>(`/stats/class/${classId}`),
  });

  const subjectList = subjects?.filter((s) => stats?.bySubject[s._id]);
  // First subject opens by default
  const subjectId = params.get('subject') || subjectList?.[0]?._id || '';
  const { data: chapters, isLoading: chaptersLoading } = useChapters({ class: classId, subject: subjectId }, !!subjectId);
  const selectSubject = (id: string) => setParams({ subject: id });
  const toggleChapter = (id: string) => setParams(id === openChapter ? { subject: subjectId } : { subject: subjectId, chapter: id });

  const chapterList = (chapters ?? []).filter((c) => stats?.byChapter[c._id]);
  // Titles like "Chapter 3 - Tissues" carry their own number; then a "Ch N" badge would only confuse.
  const showNumbers = !chapterList.some((c) => SELF_NUMBERED.test(c.title));
  const inChapters = chapterList.reduce((n, c) => n + (stats?.byChapter[c._id] ?? 0), 0);
  const other = subjectId ? (stats?.bySubject[subjectId] ?? 0) - inChapters : 0;

  return (
    <div>
      <nav className="mb-2 text-sm muted">
        <Link to="/" className="hover:underline">Home</Link> / {cls ? className(cls) : '…'}
      </nav>
      <PageHeader
        title={cls ? className(cls) : ' '}
        subtitle={stats ? `${stats.total.toLocaleString()} lectures in ${subjectList?.length ?? 0} subjects` : ' '}
        actions={<Link className="btn" to={`/timetable?class=${classId}`}>Timetable</Link>}
      />

      {isLoading ? (
        <Spinner />
      ) : !subjectList?.length ? (
        <Empty>No lectures for this class yet.</Empty>
      ) : (
        <div className="grid gap-8 md:grid-cols-[240px_1fr]">
          {/* phones: one swipeable row of subjects; md+: a vertical list */}
          <aside className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
            {subjectList.map((s) => (
              <button
                key={s._id}
                onClick={() => selectSubject(s._id)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-left text-sm whitespace-nowrap md:rounded-lg md:border-0 ${s._id === subjectId ? 'border-accent bg-subtle font-semibold text-accent' : 'border-line bg-card hover:bg-subtle md:bg-transparent'}`}
              >
                <SubjectDot color={s.color} />
                <span className="md:flex-1">{s.name}</span>
                <span className="text-xs muted">{stats?.bySubject[s._id]?.toLocaleString()}</span>
              </button>
            ))}
          </aside>

          <div className="min-w-0">
            {!subjectId ? (
              <Empty>Pick a subject to see its chapters and lectures.</Empty>
            ) : chaptersLoading ? (
              <Spinner />
            ) : (
              <div className="space-y-2">
                {chapterList.map((ch) => (
                  <ChapterSection
                    key={ch._id}
                    chapter={ch}
                    count={stats?.byChapter[ch._id] ?? 0}
                    open={ch._id === openChapter}
                    onToggle={() => toggleChapter(ch._id)}
                    showNumber={showNumbers}
                    query={{ class: classId, subject: subjectId, chapter: ch._id }}
                  />
                ))}
                {other > 0 && (
                  <p className="pt-2 text-sm muted">
                    {other.toLocaleString()} more lecture{other === 1 ? '' : 's'} in this subject aren't under a chapter for this class.{' '}
                    <Link className="link" to={`/lectures${qs({ class: classId, subject: subjectId })}`}>See all in Browse</Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterSection({ chapter, count, open, onToggle, query, showNumber }: {
  chapter: Chapter;
  showNumber: boolean;
  count: number;
  open: boolean;
  onToggle: () => void;
  query: Record<string, string>;
}) {
  const lectures = useInfiniteQuery({
    queryKey: ['lectures', 'chapter', query],
    queryFn: ({ pageParam }) => api.get<Paged<Lecture>>(`/lectures${qs({ ...query, sort: 'oldest', limit: PAGE, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: open,
  });
  const items = lectures.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="card overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-subtle">
        {showNumber && <span className="w-10 shrink-0 font-serif text-sm font-semibold text-accent">Ch {chapter.number}</span>}
        <span className="flex-1 font-medium">{chapter.title}</span>
        <span className="chip">{count.toLocaleString()}</span>
        <svg viewBox="0 0 20 20" className={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
      </button>
      {open && (
        <div className="border-t border-line">
          {lectures.isLoading ? (
            <Spinner />
          ) : (
            <>
              <ul className="divide-y divide-line">
                {items.map((l, i) => (
                  <li key={l._id}>
                    <Link to={`/lectures/${l._id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle">
                      <span className="w-7 shrink-0 text-right text-xs muted tabular-nums">{i + 1}</span>
                      <VideoThumb url={l.videoUrl} size="sm" className="w-24 rounded-md" />
                      <span className="flex-1 truncate">{l.title}</span>
                      {l.status === 'draft' && <span className="chip">Draft</span>}
                      <span className="hidden muted sm:inline">{l.teacher?.name}</span>
                      {l.durationMinutes ? <span className="muted">{l.durationMinutes} min</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              {lectures.hasNextPage && (
                <div className="border-t border-line p-3 text-center">
                  <button className="btn" onClick={() => lectures.fetchNextPage()} disabled={lectures.isFetchingNextPage}>
                    {lectures.isFetchingNextPage ? 'Loading…' : `Show more (${(count - items.length).toLocaleString()} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
