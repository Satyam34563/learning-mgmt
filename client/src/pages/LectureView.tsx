import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, className, formatBytes, formatDate, type Lecture, type Progress } from '../lib/api';
import { isStaff, useMe } from '../lib/hooks';
import Player, { isTrackable } from '../components/Player';
import VideoThumb from '../components/VideoThumb';
import { BookmarkButton, ErrorBox, LectureCard, LectureGrid, Spinner, SubjectDot } from '../components/ui';

/** The lecture's chapter in order (for "Video N of M" and the numbered list) plus related videos. */
interface Playlist {
  index: number;
  total: number;
  items: { _id: string; title: string; videoUrl?: string; durationMinutes?: number; status: Lecture['status'] }[];
  related: Lecture[];
}

export default function LectureView() {
  const { id = '' } = useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: lecture, isLoading, error } = useQuery({ queryKey: ['lecture', id], queryFn: () => api.get<Lecture>(`/lectures/${id}`) });
  const progress = useQuery({
    queryKey: ['progress', id],
    queryFn: () => api.get<Progress | null>(`/me/progress/${id}`),
    enabled: !!me,
  });
  const { data: playlist } = useQuery({
    queryKey: ['lectures', 'playlist', id],
    queryFn: () => api.get<Playlist>(`/lectures/${id}/playlist`),
    enabled: !!lecture,
  });

  const save = useMutation({
    mutationFn: (body: { positionSeconds: number; durationSeconds: number; completed?: boolean }) => api.put<Progress>(`/me/progress/${id}`, body),
    onSuccess: (p) => {
      qc.setQueryData(['progress', id], p);
      qc.invalidateQueries({ queryKey: ['continue'] });
    },
  });

  if (isLoading || (me && progress.isLoading)) return <Spinner />;
  if (error || !lecture) return <ErrorBox error={error ?? 'Lecture not found'} />;

  const done = progress.data?.completed;
  const canEdit = isStaff(me);
  const at = playlist && playlist.index >= 0 ? playlist.index : -1;
  const prev = at > 0 ? playlist!.items[at - 1] : undefined;
  const next = at >= 0 ? playlist!.items[at + 1] : undefined;
  const listName = lecture.chapter?.title ?? lecture.subject.name;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0">
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm muted">
          {lecture.classes.map((c, i) => (
            <span key={c._id}>{i > 0 && ', '}<Link to={`/classes/${c._id}?subject=${lecture.subject._id}`} className="hover:underline">{className(c)}</Link></span>
          ))}
          <span>/</span>
          <Link to={`/lectures?subject=${lecture.subject._id}`} className="flex items-center gap-1.5 hover:underline">
            <SubjectDot color={lecture.subject.color} />
            {lecture.subject.name}
          </Link>
          {lecture.chapter && (
            <>
              <span>/</span>
              <Link to={`/lectures?subject=${lecture.subject._id}&chapter=${lecture.chapter._id}`} className="hover:underline">
                Ch {lecture.chapter.number}: {lecture.chapter.title}
              </Link>
            </>
          )}
        </nav>

        {at >= 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
              <svg viewBox="0 0 16 16" className="size-3" fill="currentColor"><path d="M5 3.5v9l7-4.5z" /></svg>
            </span>
            <span className="min-w-0 truncate text-sm">
              <span className="font-semibold">Video {at + 1} of {playlist!.total}</span>
              <span className="muted"> · {listName}</span>
            </span>
            <span className="ml-auto flex shrink-0 gap-2">
              {prev ? (
                <Link className="btn" to={`/lectures/${prev._id}`} title={prev.title} aria-label="Previous video">←<span className="hidden sm:inline"> Previous</span></Link>
              ) : (
                <span className="btn opacity-40" aria-hidden>←<span className="hidden sm:inline"> Previous</span></span>
              )}
              {next ? (
                <Link className="btn-primary" to={`/lectures/${next._id}`} title={next.title} aria-label="Next video"><span className="hidden sm:inline">Next </span>→</Link>
              ) : (
                <span className="btn opacity-40" aria-hidden><span className="hidden sm:inline">Next </span>→</span>
              )}
            </span>
          </div>
        )}

        {lecture.videoUrl ? (
          <Player
            url={lecture.videoUrl}
            startAt={done ? 0 : progress.data?.positionSeconds}
            onProgress={me ? (pos, dur) => save.mutate({ positionSeconds: Math.floor(pos), durationSeconds: Math.floor(dur) }) : undefined}
          />
        ) : (
          <div className="grid aspect-video place-items-center rounded-lg bg-subtle text-sm muted">No video for this lecture</div>
        )}

        <div className="mt-5 flex flex-wrap items-start gap-3">
          <h1 className="w-full sm:w-auto sm:flex-1">{lecture.title}</h1>
          <BookmarkButton id={lecture._id} />
          {me && (
            <button
              className={done ? 'btn' : 'btn-primary'}
              onClick={() => save.mutate({ positionSeconds: progress.data?.positionSeconds ?? 0, durationSeconds: progress.data?.durationSeconds ?? 0, completed: !done })}
            >
              {done ? '✓ Completed' : 'Mark as done'}
            </button>
          )}
          {canEdit && <Link className="btn" to={`/manage/lectures/${lecture._id}/edit`}>Edit</Link>}
        </div>
        {me && lecture.videoUrl && !isTrackable(lecture.videoUrl) && (
          <p className="mt-1 text-xs muted">Progress can't be tracked automatically for this video, so mark it done when you finish.</p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Fact label="Teacher" value={lecture.teacher?.name} />
          <Fact label="Date" value={formatDate(lecture.lectureDate) + (lecture.period ? ` · P${lecture.period}` : '')} />
          <Fact label="Duration" value={lecture.durationMinutes ? `${lecture.durationMinutes} min` : ''} />
          {canEdit && <Fact label="Views" value={String(lecture.views)} />}
          {lecture.meta.map((m) => (
            <Fact key={m.key} label={m.key} value={<Link className="hover:underline" to={`/lectures?meta=${encodeURIComponent(`${m.key}:${m.value}`)}`}>{m.value}</Link>} />
          ))}
        </dl>

        {lecture.description && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-ink">{lecture.description}</p>}

        {lecture.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {lecture.tags.map((t) => <Link key={t} to={`/lectures?tag=${encodeURIComponent(t)}`} className="chip hover:border-accent/40">#{t}</Link>)}
          </div>
        )}

        {lecture.resources.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2">Attachments</h2>
            <ul className="card divide-y divide-line">
              {lecture.resources.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle">
                    <span>{r.kind === 'file' ? '📄' : '🔗'}</span>
                    <span className="flex-1 truncate">{r.label}</span>
                    <span className="muted">{formatBytes(r.size)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* phones: right after the video; desktop: the right-hand column, beside both rows */}
      <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-base">{lecture.chapter ? 'In this chapter' : 'In this subject'}</h2>
          {at >= 0 && <span className="text-xs muted">{at + 1} / {playlist!.total}</span>}
        </div>
        {playlist ? <ChapterList items={playlist.items} current={lecture._id} /> : <Spinner />}
      </aside>

      {!!playlist?.related.length && (
        <section className="min-w-0 lg:col-start-1 lg:mt-2">
          <h2 className="mb-3">More videos</h2>
          <LectureGrid>
            {playlist.related.map((l) => <LectureCard key={l._id} lecture={l} />)}
          </LectureGrid>
        </section>
      )}
    </div>
  );
}

/** Every video in the chapter, numbered in order; the playing one highlighted and scrolled into view. */
function ChapterList({ items, current }: { items: Playlist['items']; current: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);
  // Scroll the list itself (not the page) so the playing video is in view. scrollIntoView would also
  // scroll the window, which on phones jumps past the player to the list below it.
  useEffect(() => {
    const list = listRef.current;
    const item = currentRef.current;
    if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2;
  }, [current]);

  if (items.length <= 1) return <p className="text-sm muted">Nothing else yet.</p>;
  return (
    <ol ref={listRef} className="card relative max-h-[55vh] divide-y divide-line overflow-y-auto lg:max-h-[70vh]">
      {items.map((l, i) => {
        const playing = l._id === current;
        return (
          <li key={l._id}>
            <Link
              ref={playing ? currentRef : undefined}
              to={`/lectures/${l._id}`}
              aria-current={playing ? 'true' : undefined}
              className={`flex items-start gap-3 px-3 py-2.5 text-sm ${playing ? 'bg-subtle' : 'hover:bg-subtle'}`}
            >
              <span className={`w-6 shrink-0 pt-px text-right text-xs tabular-nums ${playing ? 'font-bold text-accent' : 'muted'}`}>
                {playing ? '▶' : i + 1}
              </span>
              <VideoThumb url={l.videoUrl} size="sm" className={`w-20 rounded ${playing ? 'ring-2 ring-accent' : ''}`} />
              <span className="min-w-0 flex-1">
                <span className={`line-clamp-2 ${playing ? 'font-semibold text-accent' : ''}`}>{l.title}</span>
                <span className="mt-0.5 block text-xs muted">
                  {[playing && `Now playing · ${i + 1}`, l.durationMinutes && `${l.durationMinutes} min`, l.status === 'draft' && 'Draft'].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs capitalize muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
