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
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      qc.setQueryData(['me'], await api.post<Me>('/auth/login', { userId, password }));
      qc.invalidateQueries();
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canLogIn = opts && (opts.userIdLogin || opts.local);

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="text-center">Log in</h1>
      <p className="mt-1 text-center text-sm muted">Use the same user ID and password as the School Management System.</p>
      <div className="card mt-6 space-y-4 p-6">
        <ErrorBox error={error} />
        {canLogIn && (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label" htmlFor="userId">User ID</label>
              <input
                id="userId"
                className="input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button className="btn-primary w-full py-2" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          </form>
        )}
        {opts?.sms && (
          <>
            {canLogIn && (
              <div className="flex items-center gap-3 text-xs muted">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />or<div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            )}
            {/* Full-page navigation: the server redirects to the SMS and back. Handy when already logged in there. */}
            <a className="btn w-full py-2" href={`/api/auth/sms/login?next=${encodeURIComponent(next)}`}>
              Continue with School Management System
            </a>
          </>
        )}
        {opts && !opts.userIdLogin && (
          <p className="text-xs muted">
            {opts.local
              ? "The School Management System can't be reached right now, so only portal accounts (email address as user ID) can log in."
              : "The School Management System can't be reached right now. Please try again later."}
          </p>
        )}
      </div>
    </div>
  );
}
