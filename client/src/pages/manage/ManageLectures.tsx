import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, className, formatDate, qs, type Lecture, type Paged } from '../../lib/api';
import { useClasses, useMe, useSubjects } from '../../lib/hooks';
import { Empty, ErrorBox, PageHeader, Pagination, Spinner, SubjectDot } from '../../components/ui';

export default function ManageLectures() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const qc = useQueryClient();
  const filters = {
    q: params.get('q') ?? '',
    class: params.get('class') ?? '',
    subject: params.get('subject') ?? '',
    status: params.get('status') ?? '',
    // teachers see their own lectures by default
    teacher: params.get('mine') === '0' || me?.role !== 'teacher' ? '' : me.teacher ?? '',
    page: params.get('page') ?? '1',
  };
  const set = (k: string, v: string) => setParams((p) => (v ? p.set(k, v) : p.delete(k), k !== 'page' && p.delete('page'), p));

  const { data, isLoading, error } = useQuery({
    queryKey: ['lectures', 'manage', filters],
    queryFn: () => api.get<Paged<Lecture>>(`/lectures${qs({ ...filters, sort: 'recent', limit: 25 })}`),
    placeholderData: keepPreviousData,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/lectures/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lectures'] }),
  });

  return (
    <div>
      <PageHeader title="Lectures" subtitle={data && `${data.total} total`} actions={<Link className="btn-primary" to="/manage/lectures/new">New lecture</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <form onSubmit={(e) => { e.preventDefault(); set('q', q); }} className="w-full sm:w-64">
          <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="input w-auto" value={filters.class} onChange={(e) => set('class', e.target.value)}>
          <option value="">All classes</option>
          {classes?.map((c) => <option key={c._id} value={c._id}>{className(c)}</option>)}
        </select>
        <select className="input w-auto" value={filters.subject} onChange={(e) => set('subject', e.target.value)}>
          <option value="">All subjects</option>
          {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select className="input w-auto" value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        {me?.role === 'teacher' && me.teacher && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={params.get('mine') !== '0'} onChange={(e) => set('mine', e.target.checked ? '' : '0')} />
            Only mine
          </label>
        )}
      </div>
      <ErrorBox error={error ?? remove.error} />
      {isLoading ? <Spinner /> : !data?.items.length ? <Empty>No lectures found.</Empty> : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Classes</th><th>Subject / chapter</th><th>Teacher</th><th>Date</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l._id}>
                  <td className="max-w-xs"><Link className="font-medium hover:underline" to={`/lectures/${l._id}`}>{l.title}</Link></td>
                  <td className="muted">{l.classes.map(className).join(', ')}</td>
                  <td>
                    <span className="flex items-center gap-1.5"><SubjectDot color={l.subject.color} />{l.subject.name}</span>
                    {l.chapter && <span className="text-xs muted">Ch {l.chapter.number}: {l.chapter.title}</span>}
                  </td>
                  <td className="muted">{l.teacher?.name ?? '—'}</td>
                  <td className="whitespace-nowrap muted">{formatDate(l.lectureDate)}</td>
                  <td><span className="chip">{l.status}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <Link className="btn mr-1" to={`/manage/lectures/${l._id}/edit`}>Edit</Link>
                    <button className="btn-danger" onClick={() => confirm(`Delete "${l.title}"?`) && remove.mutate(l._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={(p) => set('page', String(p))} />}
    </div>
  );
}
