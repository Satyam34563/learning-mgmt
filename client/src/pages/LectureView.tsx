import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, className, formatBytes, formatDate, type Lecture, type Paged, type Progress } from '../lib/api';
import { isStaff, useMe } from '../lib/hooks';
import Player, { isTrackable } from '../components/Player';
import { BookmarkButton, ErrorBox, Spinner, SubjectDot } from '../components/ui';

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
  const related = useQuery({
    queryKey: ['lectures', 'related', lecture?.chapter?._id ?? lecture?.subject._id],
    queryFn: () =>
      api.get<Paged<Lecture>>(
        lecture!.chapter ? `/lectures?chapter=${lecture!.chapter._id}&sort=timetable` : `/lectures?subject=${lecture!.subject._id}&class=${lecture!.classes[0]?._id}&limit=8`,
      ),
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
  const others = related.data?.items.filter((l) => l._id !== lecture._id) ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
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
          <h1 className="flex-1">{lecture.title}</h1>
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

      <aside>
        <h2 className="mb-3 text-sm">{lecture.chapter ? 'More in this chapter' : 'More in this subject'}</h2>
        {others.length ? (
          <ul className="space-y-1">
            {others.map((l) => (
              <li key={l._id}>
                <Link to={`/lectures/${l._id}`} className="block rounded-md px-3 py-2 text-sm hover:bg-subtle">
                  <div className="line-clamp-2">{l.title}</div>
                  <div className="mt-0.5 text-xs muted">{[l.teacher?.name, l.durationMinutes && `${l.durationMinutes} min`].filter(Boolean).join(' · ')}</div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm muted">Nothing else yet.</p>
        )}
      </aside>
    </div>
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
