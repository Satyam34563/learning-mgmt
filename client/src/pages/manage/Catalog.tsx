import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, className } from '../../lib/api';
import { useChapters, useClasses, useMe, useSubjects, useTeachers } from '../../lib/hooks';
import { ErrorBox, SubjectDot } from '../../components/ui';

/** Create/delete for the taxonomy: classes, subjects, chapters, teachers. */
function useCrud(resource: string) {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: [resource] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };
  return {
    create: useMutation({ mutationFn: (body: unknown) => api.post(`/${resource}`, body), onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: unknown }) => api.put(`/${resource}/${id}`, body), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/${resource}/${id}`), onSuccess: done }),
  };
}

export default function Catalog() {
  const { data: me } = useMe();
  const admin = me?.role === 'admin';
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Classes canEdit={admin} />
      <Subjects canEdit={admin} />
      <Chapters />
      <Teachers canEdit={admin} />
    </div>
  );
}

function Panel({ title, error, form, children }: { title: string; error?: unknown; form?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-base">{title}</h2>
      <ErrorBox error={error} />
      <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">{children}</ul>
      {form && <div className="mt-3 border-t border-line pt-3">{form}</div>}
    </section>
  );
}

function Row({ children, onDelete }: { children: ReactNode; onDelete?: () => void }) {
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {onDelete && <button className="text-xs muted hover:text-danger-ink" onClick={() => confirm('Delete this item?') && onDelete()}>Delete</button>}
    </li>
  );
}

function Classes({ canEdit }: { canEdit: boolean }) {
  const { data } = useClasses();
  const { create, remove } = useCrud('classes');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ name, section, order: Number(name.match(/\d+/)?.[0] ?? 0) }, { onSuccess: () => { setName(''); setSection(''); } });
  };
  return (
    <Panel
      title="Classes"
      error={create.error ?? remove.error}
      form={canEdit && (
        <form onSubmit={submit} className="flex gap-2">
          <input className="input" placeholder="Class 11" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input w-28" placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} />
          <button className="btn-primary">Add</button>
        </form>
      )}
    >
      {data?.map((c) => <Row key={c._id} onDelete={canEdit ? () => remove.mutate(c._id) : undefined}>{className(c)}</Row>)}
    </Panel>
  );
}

function Subjects({ canEdit }: { canEdit: boolean }) {
  const { data } = useSubjects();
  const { create, update, remove } = useCrud('subjects');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ name, color }, { onSuccess: () => setName('') });
  };
  return (
    <Panel
      title="Subjects"
      error={create.error ?? update.error ?? remove.error}
      form={canEdit && (
        <form onSubmit={submit} className="flex gap-2">
          <input type="color" className="h-8 w-10 shrink-0 cursor-pointer rounded border border-line" value={color} onChange={(e) => setColor(e.target.value)} />
          <input className="input" placeholder="Computer Science" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn-primary">Add</button>
        </form>
      )}
    >
      {data?.map((s) => (
        <Row key={s._id} onDelete={canEdit ? () => remove.mutate(s._id) : undefined}>
          {canEdit ? (
            <input type="color" title="Change colour" className="size-4 cursor-pointer rounded-full border-0 bg-transparent p-0" value={s.color} onChange={(e) => update.mutate({ id: s._id, body: { color: e.target.value } })} />
          ) : (
            <SubjectDot color={s.color} />
          )}
          {s.name}
          {s.code && <span className="muted">{s.code}</span>}
        </Row>
      ))}
    </Panel>
  );
}

function Chapters() {
  const { data: subjects } = useSubjects();
  const { data: classes } = useClasses();
  const [subject, setSubject] = useState('');
  const { data } = useChapters({ subject });
  const { create, remove } = useCrud('chapters');
  const [title, setTitle] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // numbered within the chosen class(es), not across the whole subject
    const sameClass = (data ?? []).filter((c) => !classIds.length || (c.classes as string[]).some((id) => classIds.includes(id)));
    const number = sameClass.reduce((m, c) => Math.max(m, c.number), 0) + 1;
    create.mutate({ subject, title, classes: classIds, number }, { onSuccess: () => setTitle('') });
  };
  return (
    <Panel
      title="Chapters"
      error={create.error ?? remove.error}
      form={subject && (
        <form onSubmit={submit} className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {classes?.map((c) => (
              <label key={c._id} className="chip cursor-pointer">
                <input type="checkbox" className="mr-1" checked={classIds.includes(c._id)} onChange={(e) => setClassIds(e.target.checked ? [...classIds, c._id] : classIds.filter((x) => x !== c._id))} />
                {className(c)}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="Chapter title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <button className="btn-primary">Add</button>
          </div>
        </form>
      )}
    >
      <li className="pb-2">
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Choose a subject…</option>
          {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </li>
      {subject && data?.map((c) => (
        <Row key={c._id} onDelete={() => remove.mutate(c._id)}>
          <span className="w-6 shrink-0 muted">{c.number}.</span>
          <span className="truncate">{c.title}</span>
          <span className="ml-auto shrink-0 text-xs muted">
            {(c.classes as string[]).map((id) => classes?.find((x) => x._id === id)).filter(Boolean).map((x) => className(x!)).join(', ')}
          </span>
        </Row>
      ))}
    </Panel>
  );
}

function Teachers({ canEdit }: { canEdit: boolean }) {
  const { data } = useTeachers();
  const { create, remove } = useCrud('teachers');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ name, email }, { onSuccess: () => { setName(''); setEmail(''); } });
  };
  return (
    <Panel
      title="Teachers"
      error={create.error ?? remove.error}
      form={canEdit && (
        <form onSubmit={submit} className="flex gap-2">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary">Add</button>
        </form>
      )}
    >
      {data?.map((t) => (
        <Row key={t._id} onDelete={canEdit ? () => remove.mutate(t._id) : undefined}>
          {t.name}
          {t.email && <span className="truncate muted">{t.email}</span>}
        </Row>
      ))}
    </Panel>
  );
}
