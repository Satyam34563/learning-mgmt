import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, className, formatBytes, type Lecture, type MetaPair, type Resource } from '../../lib/api';
import { useChapters, useClasses, useMe, useSubjects, useTeachers } from '../../lib/hooks';
import { ErrorBox, PageHeader, Spinner } from '../../components/ui';

interface FormState {
  title: string;
  description: string;
  classes: string[];
  subject: string;
  chapter: string;
  teacher: string;
  videoUrl: string;
  durationMinutes: string;
  lectureDate: string;
  period: string;
  tags: string;
  meta: MetaPair[];
  resources: Resource[];
  status: 'draft' | 'published';
}

const EMPTY: FormState = {
  title: '', description: '', classes: [], subject: '', chapter: '', teacher: '', videoUrl: '',
  durationMinutes: '', lectureDate: '', period: '', tags: '', meta: [], resources: [], status: 'published',
};

function fromLecture(l: Lecture): FormState {
  return {
    title: l.title,
    description: l.description,
    classes: l.classes.map((c) => c._id),
    subject: l.subject._id,
    chapter: l.chapter?._id ?? '',
    teacher: l.teacher?._id ?? '',
    videoUrl: l.videoUrl,
    durationMinutes: l.durationMinutes?.toString() ?? '',
    lectureDate: l.lectureDate?.slice(0, 10) ?? '',
    period: l.period?.toString() ?? '',
    tags: l.tags.join(', '),
    meta: l.meta,
    resources: l.resources,
    status: l.status,
  };
}

export default function LectureForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [f, setF] = useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const existing = useQuery({ queryKey: ['lecture', id], queryFn: () => api.get<Lecture>(`/lectures/${id}`), enabled: !!id });
  useEffect(() => {
    if (existing.data) setF(fromLecture(existing.data));
    else if (!id && me?.teacher) setF((s) => ({ ...s, teacher: me.teacher! }));
  }, [existing.data, id, me?.teacher]);

  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const { data: teachers } = useTeachers();
  const { data: chapters } = useChapters({ subject: f.subject });
  // Chapters are offered only for the chosen subject; prefer ones that match a chosen class.
  const chapterOptions = chapters?.filter((c) => !f.classes.length || !c.classes.length || (c.classes as string[]).some((cid) => f.classes.includes(cid)));

  const save = useMutation({
    mutationFn: (body: unknown) => (id ? api.put<Lecture>(`/lectures/${id}`, body) : api.post<Lecture>('/lectures', body)),
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ['lectures'] });
      qc.invalidateQueries({ queryKey: ['lecture', l._id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      navigate(`/lectures/${l._id}`);
    },
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post<Resource>('/uploads', fd);
        setF((s) => ({ ...s, resources: [...s.resources, res] }));
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      ...f,
      durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : undefined,
      period: f.period ? Number(f.period) : undefined,
      lectureDate: f.lectureDate || undefined,
      chapter: f.chapter || null,
      teacher: f.teacher || null,
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      meta: f.meta.filter((m) => m.key.trim() && m.value.trim()),
    });
  }

  if (id && existing.isLoading) return <Spinner />;

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <PageHeader title={id ? 'Edit lecture' : 'New lecture'} />
      <ErrorBox error={existing.error ?? save.error} />

      <Section title="Basics">
        <Field label="Title *">
          <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} required />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-24" value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Video URL" hint="YouTube, Google Drive, or a direct .mp4 link">
          <input className="input" type="url" value={f.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://" />
        </Field>
      </Section>

      <Section title="Category">
        <Field label="Classes *">
          <div className="flex flex-wrap gap-2">
            {classes?.map((c) => {
              const on = f.classes.includes(c._id);
              return (
                <button
                  type="button"
                  key={c._id}
                  onClick={() => set('classes', on ? f.classes.filter((x) => x !== c._id) : [...f.classes, c._id])}
                  className={`rounded-md border px-3 py-1 text-sm ${on ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}
                >
                  {className(c)}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Subject *">
            <select className="input" value={f.subject} onChange={(e) => setF((s) => ({ ...s, subject: e.target.value, chapter: '' }))} required>
              <option value="">Select…</option>
              {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Chapter">
            <select className="input" value={f.chapter} onChange={(e) => set('chapter', e.target.value)} disabled={!f.subject}>
              <option value="">None</option>
              {chapterOptions?.map((c) => <option key={c._id} value={c._id}>{c.number}. {c.title}</option>)}
            </select>
          </Field>
          <Field label="Teacher">
            <select className="input" value={f.teacher} onChange={(e) => set('teacher', e.target.value)}>
              <option value="">Not specified</option>
              {teachers?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Tags" hint="Comma separated">
          <input className="input" value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="revision, important" />
        </Field>
      </Section>

      <Section title="Schedule">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date"><input type="date" className="input" value={f.lectureDate} onChange={(e) => set('lectureDate', e.target.value)} /></Field>
          <Field label="Period"><input type="number" min={1} max={12} className="input" value={f.period} onChange={(e) => set('period', e.target.value)} /></Field>
          <Field label="Duration (min)"><input type="number" min={0} className="input" value={f.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Extra details" hint="Any key–value pairs, e.g. term = Term 1, board = CBSE, language = Hindi. They become filters in Browse.">
        {f.meta.map((m, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" placeholder="Key" value={m.key} onChange={(e) => set('meta', f.meta.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
            <input className="input" placeholder="Value" value={m.value} onChange={(e) => set('meta', f.meta.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <button type="button" className="btn" onClick={() => set('meta', f.meta.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set('meta', [...f.meta, { key: '', value: '' }])}>+ Add detail</button>
      </Section>

      <Section title="Attachments" hint="Notes, worksheets, slides. PDF, Office files, images, up to 25 MB each.">
        <ErrorBox error={uploadError} />
        {f.resources.map((r, i) => (
          <div key={r.url} className="flex items-center gap-2 text-sm">
            <span>{r.kind === 'file' ? '📄' : '🔗'}</span>
            <input className="input" value={r.label} onChange={(e) => set('resources', f.resources.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <span className="w-20 shrink-0 text-right text-xs muted">{formatBytes(r.size)}</span>
            <button type="button" className="btn" onClick={() => set('resources', f.resources.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <label className="btn">
            {uploading ? 'Uploading…' : 'Upload files'}
            <input type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} disabled={uploading} />
          </label>
          <AddLink onAdd={(r) => set('resources', [...f.resources, r])} />
        </div>
      </Section>

      <div className="flex items-center gap-3 border-t border-line pt-6">
        <select className="input w-auto" value={f.status} onChange={(e) => set('status', e.target.value as FormState['status'])}>
          <option value="published">Published</option>
          <option value="draft">Draft (staff only)</option>
        </select>
        <button className="btn-primary" disabled={save.isPending || uploading}>{save.isPending ? 'Saving…' : 'Save lecture'}</button>
        <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
      </div>
    </form>
  );
}

function AddLink({ onAdd }: { onAdd: (r: Resource) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>+ Add link</button>;
  return (
    <div className="flex w-full gap-2">
      <input className="input" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input className="input" placeholder="https://" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button
        type="button"
        className="btn"
        disabled={!label || !URL.canParse(url)}
        onClick={() => { onAdd({ label, url, kind: 'link' }); setLabel(''); setUrl(''); setOpen(false); }}
      >
        Add
      </button>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base">{title}</h2>
        {hint && <p className="text-xs muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}{hint && <span className="ml-1 font-normal">· {hint}</span>}</label>
      {children}
    </div>
  );
}
