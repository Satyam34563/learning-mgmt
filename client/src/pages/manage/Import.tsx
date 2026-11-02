import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMe } from '../../lib/hooks';
import { ErrorBox, PageHeader } from '../../components/ui';

interface ImportResult {
  total: number;
  valid: number;
  imported: number;
  errors: { row: number; message: string }[];
}

export default function Import() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [create, setCreate] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<ImportResult>(`/import/lectures?dryRun=${dryRun}&create=${create}`, fd);
      setResult(res);
      setChecked(dryRun && !res.errors.length);
      if (!dryRun && res.imported) {
        qc.invalidateQueries();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Bulk import"
        subtitle="Upload a CSV or Excel (.xlsx) file to add many lectures at once."
        actions={<a className="btn" href="/api/import/lectures/template">Download template</a>}
      />

      <div className="card space-y-4 p-5">
        <div className="text-sm muted">
          <p>Required columns: <b>title</b>, <b>subject</b>, <b>classes</b> (separate several with <code>;</code>).</p>
          <p className="mt-1">
            Optional: chapter (number or title), teacher, description, videoUrl, durationMinutes, lectureDate (YYYY-MM-DD), period, tags (<code>;</code>-separated),
            status, and any <code>meta.&lt;key&gt;</code> column such as <code>meta.term</code>.
          </p>
        </div>
        <input
          type="file"
          accept=".csv,.xlsx"
          className="block text-sm file:mr-3 file:rounded-md file:border file:border-zinc-200 file:bg-white file:px-3 file:py-1.5 file:text-sm dark:file:border-zinc-800 dark:file:bg-zinc-900"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setChecked(false); }}
        />
        {me?.role === 'admin' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={create} onChange={(e) => { setCreate(e.target.checked); setChecked(false); }} />
            Create classes, subjects, chapters and teachers that don't exist yet
          </label>
        )}
        <div className="flex gap-2">
          <button className="btn" disabled={!file || busy} onClick={() => run(true)}>Check file</button>
          <button className="btn-primary" disabled={!file || busy || !checked} onClick={() => run(false)}>
            {busy ? 'Working…' : 'Import'}
          </button>
        </div>
        <ErrorBox error={error} />
      </div>

      {result && (
        <div className="mt-6 space-y-3">
          <p className="text-sm">
            {result.imported
              ? `✓ Imported ${result.imported} lecture${result.imported === 1 ? '' : 's'}.`
              : `${result.valid} of ${result.total} rows are valid.${checked ? ' Ready to import.' : ''}`}
          </p>
          {result.errors.length > 0 && (
            <table className="table">
              <thead><tr><th className="w-20">Row</th><th>Problem</th></tr></thead>
              <tbody>
                {result.errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.message}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
