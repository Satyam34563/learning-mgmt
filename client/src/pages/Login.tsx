import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, type Me } from '../lib/api';
import { useAuthOptions, useMe } from '../lib/hooks';
import { ErrorBox } from '../components/ui';

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { data: me } = useMe();
  const { data: opts } = useAuthOptions();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      qc.setQueryData(['me'], await api.post<Me>('/auth/login', { email, password }));
      qc.invalidateQueries();
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="text-center">Log in</h1>
      <p className="mt-1 text-center text-sm muted">Use your school account.</p>
      <div className="card mt-6 space-y-4 p-6">
        <ErrorBox error={error} />
        {opts?.sms && (
          // Full-page navigation: the server redirects to the SMS and back.
          <a className="btn-primary w-full py-2" href={`/api/auth/sms/login?next=${encodeURIComponent(next)}`}>
            Continue with School Management System
          </a>
        )}
        {opts?.sms && opts.local && (
          <div className="flex items-center gap-3 text-xs muted">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or<div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        )}
        {opts?.local && (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button className={opts.sms ? 'btn w-full' : 'btn-primary w-full'} disabled={busy}>{busy ? 'Logging in…' : 'Log in with portal account'}</button>
            {opts.sms && <p className="text-xs muted">For accounts created in this portal. Students and staff use the School Management System button above.</p>}
          </form>
        )}
        {opts && !opts.sms && (
          <p className="text-sm muted">
            School Management System login isn't available right now.{opts.local ? ' Only portal accounts can log in.' : ' Contact the administrator.'}
          </p>
        )}
      </div>
    </div>
  );
}
