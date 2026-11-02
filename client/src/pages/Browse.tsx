import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, className, qs, type Lecture, type Paged } from '../lib/api';
import { isStaff, useChapters, useClasses, useMe, useSubjects, useTeachers } from '../lib/hooks';
import { Empty, ErrorBox, LectureCard, LectureGrid, PageHeader, Pagination, Spinner } from '../components/ui';

const FILTER_KEYS = ['q', 'class', 'subject', 'chapter', 'teacher', 'tag', 'meta', 'from', 'to', 'status', 'sort'] as const;

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const page = Number(params.get('page') ?? 1);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    // chapter belongs to a subject; drop it when the subject changes
    if ('subject' in patch) next.delete('chapter');
    setParams(next);
  };

  const query = Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k)]));
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['lectures', query, page],
    queryFn: () => api.get<Paged<Lecture>>(`/lectures${qs({ ...query, page, limit: 24 })}`),
    placeholderData: keepPreviousData,
  });

  const active = FILTER_KEYS.filter((k) => k !== 'sort' && get(k)).length;

  return (
    <div>
      <PageHeader
        title="Browse lectures"
        subtitle={data ? `${data.total} result${data.total === 1 ? '' : 's'}${isFetching ? '…' : ''}` : ' '}
        actions={
          <select className="input w-auto" value={get('sort')} onChange={(e) => set({ sort: e.target.value })}>
            <option value="">{get('q') ? 'Best match' : 'Newest first'}</option>
            <option value="oldest">Oldest first</option>
            <option value="recent">Recently added</option>
            <option value="popular">Most watched</option>
            <option value="title">Title A–Z</option>
          </select>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <Filters get={get} set={set} active={active} clear={() => setParams(new URLSearchParams())} />
        <div>
          <ErrorBox error={error} />
          {isLoading ? (
            <Spinner />
          ) : !data?.items.length ? (
            <Empty>No lectures match these filters.</Empty>
          ) : (
            <>
              <LectureGrid>
                {data.items.map((l) => <LectureCard key={l._id} lecture={l} />)}
              </LectureGrid>
              <Pagination page={data.page} pages={data.pages} onChange={(p) => set({ page: String(p) })} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FiltersProps {
  get: (k: string) => string;
  set: (patch: Record<string, string>) => void;
  active: number;
  clear: () => void;
}

function Filters({ get, set, active, clear }: FiltersProps) {
  const { data: me } = useMe();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const { data: teachers } = useTeachers();
  const { data: chapters } = useChapters({ subject: get('subject'), ...(get('class') && { class: get('class') }) });
  const { data: metaKeys } = useQuery({
    queryKey: ['meta-keys'],
    queryFn: () => api.get<{ key: string; values: string[] }[]>('/lectures/meta-keys'),
    staleTime: 5 * 60_000,
  });
  const [q, setQ] = useState(get('q'));
  useEffect(() => setQ(get('q')), [get('q')]); // eslint-disable-line react-hooks/exhaustive-deps

  // meta is stored in the URL as "key:value,key:value"
  const meta = Object.fromEntries(get('meta').split(',').filter(Boolean).map((p) => [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)]));
  const setMeta = (key: string, value: string) => {
    const next = { ...meta, [key]: value };
    set({ meta: Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(',') });
  };

  return (
    <aside className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
        <label className="label">Search</label>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, topic, tag…" />
      </form>
      <Select label="Class" value={get('class')} onChange={(v) => set({ class: v })} options={classes?.map((c) => [c._id, className(c)])} />
      <Select label="Subject" value={get('subject')} onChange={(v) => set({ subject: v })} options={subjects?.map((s) => [s._id, s.name])} />
      {get('subject') && (
        <Select label="Chapter" value={get('chapter')} onChange={(v) => set({ chapter: v })} options={chapters?.map((c) => [c._id, `${c.number}. ${c.title}`])} />
      )}
      <Select label="Teacher" value={get('teacher')} onChange={(v) => set({ teacher: v })} options={teachers?.map((t) => [t._id, t.name])} />
      {metaKeys?.map((m) => (
        <Select
          key={m.key}
          label={m.key.charAt(0).toUpperCase() + m.key.slice(1)}
          value={meta[m.key] ?? ''}
          onChange={(v) => setMeta(m.key, v)}
          options={m.values.map((v) => [v, v])}
        />
      ))}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={get('from')} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={get('to')} onChange={(e) => set({ to: e.target.value })} />
        </div>
      </div>
      {isStaff(me) && (
        <Select label="Status" value={get('status')} onChange={(v) => set({ status: v })} options={[['published', 'Published'], ['draft', 'Draft']]} />
      )}
      {get('tag') && (
        <div>
          <label className="label">Tag</label>
          <button className="chip" onClick={() => set({ tag: '' })}>#{get('tag')} ✕</button>
        </div>
      )}
      {active > 0 && <button className="btn w-full" onClick={clear}>Clear filters ({active})</button>}
    </aside>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options?: string[][] }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options?.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  );
}
